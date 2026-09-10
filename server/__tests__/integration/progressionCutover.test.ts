/**
 * Progression / entitlement decomposition — transactional cutover (§18.2, ADR-016).
 *
 * Runs the real app against a pglite database so `progressionService` +
 * `progressionCutover` are wired: the reward hot path writes the typed tables in
 * one transaction, `readProfile` overlays them, and the legacy blob is mirrored
 * (or frozen under `LEGACY_PROGRESSION_READONLY`).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../../config/env';
import { createApp } from '../../app';
import { createSqlWalletLedger, type WalletLedger } from '../../wallet';
import { createMemoryIdempotencyStore } from '../../lib/idempotency';
import { createMemoryMigrationStore } from '../../migration/migrationStore';
import { createMemoryAuditLog } from '../../audit';
import { createMemoryStore } from '../helpers/memoryStore';
import { createTestDatabase, type TestDatabase } from '../../infrastructure/database/testing';

let tdb: TestDatabase;

beforeEach(async () => {
  tdb = await createTestDatabase();
});
afterEach(async () => {
  await tdb.close();
});

function makeApp(env: Record<string, string> = {}, walletLedger?: WalletLedger) {
  const { config } = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'development', ...env });
  const app = createApp({
    config,
    database: tdb.db,
    dbStore: createMemoryStore(),
    walletLedger,
    idempotency: createMemoryIdempotencyStore(),
    migrationStore: createMemoryMigrationStore(),
    auditLog: createMemoryAuditLog(),
  });
  return app;
}

const rows = async (sqlText: string, params: unknown[] = []) =>
  (await tdb.client.query(sqlText, params)).rows as Array<Record<string, unknown>>;

const level = (o: Record<string, unknown> = {}) => ({
  kind: 'level',
  idempotencyKey: 'k1',
  runId: 'r1',
  difficulty: 'child',
  themeId: 'gospels',
  correctCount: 7,
  totalQuestions: 7,
  ...o,
});

const post = (app: ReturnType<typeof makeApp>, path: string, uid: string, body: unknown) =>
  request(app).post(path).set('x-user-id', uid).send(body);

describe('progression cutover — transactional write path', () => {
  it('a completion writes progression_state + wallet_ledger + achievement_grants + player_theme_stats in one commit', async () => {
    const app = makeApp();
    const res = await post(app, '/api/v1/progression/completions', '7', level());
    expect(res.status).toBe(200);
    expect(res.body.delta.coins).toBe(15);

    expect(await rows('select * from progression_state where user_id = $1', ['7'])).toHaveLength(1);
    const wallet = await rows('select * from wallet_ledger where user_id = $1', ['7']);
    expect(wallet).toHaveLength(1);
    expect(Number(wallet[0].amount)).toBe(15);
    const grants = await rows('select achievement_id from achievement_grants where user_id = $1', ['7']);
    expect(grants.map((g) => g.achievement_id)).toContain('flawless-level');
    const stats = await rows('select * from player_theme_stats where user_id = $1', ['7']);
    expect(stats).toHaveLength(1);
    expect(Number(stats[0].total_points)).toBe(15);

    const profile = await request(app).get('/api/v1/me/profile').set('x-user-id', '7');
    expect(profile.body.coins).toBe(15);
    expect(profile.body.playerRank.wisdomPoints).toBe(0);
    expect(profile.body.completedLevels).toHaveLength(1);
    expect(profile.body.achievements).toContain('flawless-level');
  });

  it('dual-writes the legacy blob by default, and freezes it under LEGACY_PROGRESSION_READONLY', async () => {
    const dual = makeApp();
    await post(dual, '/api/v1/progression/completions', '7', level());
    const mirrored = await rows('select payload from player_profiles where user_id = $1', ['7']);
    expect(mirrored).toHaveLength(1);
    expect((mirrored[0].payload as Record<string, unknown>).completedLevels).toHaveLength(1);

    const frozen = makeApp({ LEGACY_PROGRESSION_READONLY: 'true' });
    await post(frozen, '/api/v1/progression/completions', '8', level());
    expect(await rows('select 1 from player_profiles where user_id = $1', ['8'])).toHaveLength(0);
    // …but the typed row and the read overlay are still correct
    const profile = await request(frozen).get('/api/v1/me/profile').set('x-user-id', '8');
    expect(profile.body.completedLevels).toHaveLength(1);
  });

  it('rolls the whole reward back when a write inside the transaction throws', async () => {
    const brokenWallet: WalletLedger = {
      ...createSqlWalletLedger(tdb.db),
      post: async () => {
        throw new Error('boom');
      },
    };
    const app = makeApp({}, brokenWallet);

    await expect(
      post(app, '/api/v1/progression/completions', '7', level()).then((r) => r.status),
    ).resolves.toBe(500);

    expect(await rows('select 1 from progression_state where user_id = $1', ['7'])).toHaveLength(0);
    expect(await rows('select 1 from wallet_ledger where user_id = $1', ['7'])).toHaveLength(0);
  });

  it('the read overlay layers the typed row on top of a stale blob', async () => {
    const app = makeApp();
    // create the users row + a stale blob
    await request(app).get('/api/v1/me').set('x-user-id', '9');
    await tdb.client.query(
      `insert into progression_state (user_id, streak_days, survival_high_score)
       values ($1, 12, 999) on conflict (user_id) do update set streak_days = 12, survival_high_score = 999`,
      ['9'],
    );

    const profile = await request(app).get('/api/v1/me/profile').set('x-user-id', '9');
    expect(profile.body.streakDays).toBe(12);
    expect(profile.body.survivalHighScore).toBe(999);
  });

  it('concurrent completions for one user both land (no lost update)', async () => {
    const app = makeApp();
    await Promise.all([
      post(app, '/api/v1/progression/completions', '7', level({ idempotencyKey: 'lv', runId: 'lv' })),
      post(app, '/api/v1/progression/completions', '7', {
        kind: 'survival',
        idempotencyKey: 'sv',
        runId: 'sv',
        score: 40,
      }),
    ]);

    const profile = await request(app).get('/api/v1/me/profile').set('x-user-id', '7');
    expect(profile.body.completedLevels).toHaveLength(1); // from the level
    expect(profile.body.survivalHighScore).toBe(40); // from the survival run
  });
});

describe('progression cutover — /answers', () => {
  const answer = (o: Record<string, unknown> = {}) => ({
    questionId: 'q1',
    themeId: 'gospels',
    nodeId: 'gospels-life',
    isCorrect: true,
    idempotencyKey: 'a1',
    ...o,
  });

  it('appends one study_answers row per answer, idempotent on the key', async () => {
    const app = makeApp();
    await post(app, '/api/v1/progression/answers', '7', answer());
    await post(app, '/api/v1/progression/answers', '7', answer()); // same key → no-op
    await post(app, '/api/v1/progression/answers', '7', answer({ idempotencyKey: 'a2', questionId: 'q2' }));

    expect(await rows('select * from study_answers where user_id = $1', ['7'])).toHaveLength(2);

    const history = await request(app).get('/api/v1/me/study/answers').set('x-user-id', '7');
    expect(history.body).toHaveLength(2);
    expect(history.body[0].questionId).toBe('q1');

    const profile = await request(app).get('/api/v1/me/profile').set('x-user-id', '7');
    expect(profile.body.studyMastery['gospels-life'].totalAnswers).toBe(2);
  });

  it('five parallel answers with distinct keys all persist', async () => {
    const app = makeApp();
    await Promise.all(
      [0, 1, 2, 3, 4].map((i) =>
        post(app, '/api/v1/progression/answers', '7', answer({ idempotencyKey: `k${i}`, questionId: `q${i}` })),
      ),
    );
    expect(await rows('select * from study_answers where user_id = $1', ['7'])).toHaveLength(5);
  });
});

describe('progression cutover — shop purchases', () => {
  it('a purchase writes an entitlements row + a wallet spend in one transaction', async () => {
    const app = makeApp();
    // fund: survival score == coins
    await post(app, '/api/v1/progression/completions', '7', {
      kind: 'survival',
      idempotencyKey: 'fund',
      runId: 'fund',
      score: 400,
    });

    const buy = await post(app, '/api/v1/shop/purchases', '7', {
      kind: 'theme',
      itemId: 'gennesaret-sea',
      idempotencyKey: 'p1',
    });
    expect(buy.status).toBe(200);
    expect(buy.body.unlockedThemes).toContain('gennesaret-sea');
    expect(buy.body.balance).toBe(100);

    const ent = await rows('select * from entitlements where user_id = $1', ['7']);
    expect(ent).toHaveLength(1);
    expect(ent[0].product_id).toBe('gennesaret-sea');
    expect(ent[0].source_type).toBe('purchase');

    const profile = await request(app).get('/api/v1/me/profile').set('x-user-id', '7');
    expect(profile.body.unlockedThemes).toContain('gennesaret-sea');

    // replaying the same purchase is a no-op
    const replay = await post(app, '/api/v1/shop/purchases', '7', {
      kind: 'theme',
      itemId: 'gennesaret-sea',
      idempotencyKey: 'p1',
    });
    expect(replay.status).toBe(200);
    expect(await rows('select * from entitlements where user_id = $1', ['7'])).toHaveLength(1);
  });

  it('an unaffordable purchase leaves no entitlement row and no partial state', async () => {
    const app = makeApp();
    const buy = await post(app, '/api/v1/shop/purchases', '7', {
      kind: 'theme',
      itemId: 'gennesaret-sea',
      idempotencyKey: 'p1',
    });
    expect(buy.status).toBe(409);
    expect(await rows('select 1 from entitlements where user_id = $1', ['7'])).toHaveLength(0);
    expect(await rows('select 1 from wallet_ledger where user_id = $1', ['7'])).toHaveLength(0);
  });
});
