import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../../config/env';
import { createApp } from '../../app';
import { createMemoryWalletLedger } from '../../wallet';
import { createMemoryIdempotencyStore } from '../../lib/idempotency';
import { createMemoryMigrationStore } from '../../migration/migrationStore';
import { createMemoryAuditLog } from '../../audit';
import { createMemoryStore } from '../helpers/memoryStore';

function makeApp(env: Record<string, string> = {}) {
  const { config } = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'development', ...env });
  const walletLedger = createMemoryWalletLedger();
  const dbStore = createMemoryStore();
  const deps = {
    config,
    dbStore,
    walletLedger,
    idempotency: createMemoryIdempotencyStore(),
    migrationStore: createMemoryMigrationStore(),
    auditLog: createMemoryAuditLog(),
  };
  return { app: createApp(deps), walletLedger, dbStore };
}

const level = (overrides: Record<string, unknown> = {}) => ({
  kind: 'level',
  idempotencyKey: 'k1',
  runId: 'r1',
  difficulty: 'child',
  themeId: 'gospels',
  correctCount: 7,
  totalQuestions: 7,
  ...overrides,
});

describe('POST /api/v1/progression/completions', () => {
  it('grants coins once and returns a stable eventId', async () => {
    const { app, walletLedger } = makeApp();
    const res = await request(app)
      .post('/api/v1/progression/completions')
      .set('x-user-id', '7')
      .send(level());
    expect(res.status).toBe(200);
    expect(res.body.delta.coins).toBe(15);
    expect(res.body.next.coins).toBe(15);
    expect(res.body.eventId).toMatch(/^[0-9a-f]{32}$/);
    expect(await walletLedger.getBalance('7')).toBe(15);

    const profile = await request(app).get('/api/v1/me/profile').set('x-user-id', '7');
    expect(profile.body.coins).toBe(15);
  });

  it('replays an identical idempotencyKey without a second grant', async () => {
    const { app, walletLedger } = makeApp();
    const a = await request(app).post('/api/v1/progression/completions').set('x-user-id', '7').send(level());
    const b = await request(app).post('/api/v1/progression/completions').set('x-user-id', '7').send(level());
    expect(b.body.eventId).toBe(a.body.eventId);
    expect(await walletLedger.getBalance('7')).toBe(15);
  });

  it('grants once under a concurrent double-submit', async () => {
    const { app, walletLedger } = makeApp();
    await Promise.all([
      request(app).post('/api/v1/progression/completions').set('x-user-id', '7').send(level()),
      request(app).post('/api/v1/progression/completions').set('x-user-id', '7').send(level()),
    ]);
    expect(await walletLedger.getBalance('7')).toBe(15);
  });

  it('rejects correctCount > totalQuestions', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/v1/progression/completions')
      .set('x-user-id', '7')
      .send(level({ correctCount: 9 }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_completion');
  });
});

const practiceStage = (overrides: Record<string, unknown> = {}) => ({
  kind: 'practice_stage',
  idempotencyKey: 'ps1',
  runId: 'run1',
  difficulty: 'child',
  themeId: 'gospels',
  nodeId: 'gospels-life',
  stageIndex: 0,
  correctCount: 8,
  totalQuestions: 10,
  ...overrides,
});

describe('POST /api/v1/progression/completions — practice tracks', () => {
  it('persists a practice track and advances highestUnlockedStage', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/v1/progression/completions')
      .set('x-user-id', '7')
      .send(practiceStage());
    expect(res.status).toBe(200);
    expect(res.body.delta.nextStageUnlocked).toBe(true);

    const profile = await request(app).get('/api/v1/me/profile').set('x-user-id', '7');
    expect(profile.body.practiceTracks).toHaveLength(1);
    expect(profile.body.practiceTracks[0].highestUnlockedStage).toBe(1);
    expect(profile.body.practiceTracks[0].stageResults[0]).toMatchObject({
      stageIndex: 0,
      passed: true,
      attempts: 1,
    });
  });

  it('re-running an aced stage under a fresh runId grants no extra coins', async () => {
    const { app, walletLedger } = makeApp();
    await request(app)
      .post('/api/v1/progression/completions')
      .set('x-user-id', '7')
      .send(practiceStage({ correctCount: 10, idempotencyKey: 'k-a', runId: 'run-a' }));
    const balance = await walletLedger.getBalance('7');
    expect(balance).toBeGreaterThan(0);

    const replay = await request(app)
      .post('/api/v1/progression/completions')
      .set('x-user-id', '7')
      .send(practiceStage({ correctCount: 10, idempotencyKey: 'k-b', runId: 'run-b' }));
    expect(replay.body.delta.coins).toBe(0);
    expect(await walletLedger.getBalance('7')).toBe(balance);
  });
});

describe('PATCH /api/v1/me/learning-state', () => {
  it('stores the reviewSchedules blob verbatim', async () => {
    const { app } = makeApp();
    const schedule = {
      'gospels-life:recall': {
        learningObjectiveId: 'gospels-life:recall',
        themeId: 'gospels',
        nodeId: 'gospels-life',
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 1,
        dueAt: '2026-09-10T00:00:00.000Z',
        lastReviewedAt: '2026-09-07T00:00:00.000Z',
      },
    };
    const res = await request(app)
      .patch('/api/v1/me/learning-state')
      .set('x-user-id', '7')
      .send({ reviewSchedules: schedule });
    expect(res.status).toBe(200);
    expect(res.body.reviewSchedules['gospels-life:recall'].easeFactor).toBe(2.5);
  });
});

describe('preference write whitelist', () => {
  it('PATCH /api/v1/me/preferences changes only whitelisted fields', async () => {
    const { app, dbStore } = makeApp();
    // seed an owned theme so activeTheme is accepted
    await dbStore.setProfile('7', { userId: '7', unlockedThemes: ['dawn'], displayName: 'old' });

    const res = await request(app)
      .patch('/api/v1/me/preferences')
      .set('x-user-id', '7')
      .send({ displayName: 'Grace', activeTheme: 'dawn', coins: 99999 });
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Grace');
    expect(res.body.activeTheme).toBe('dawn');
    expect(res.body.coins).not.toBe(99999);
  });

  it('there is no whole-profile PUT — coins/rank cannot be set as final values', async () => {
    const { app } = makeApp();
    await request(app)
      .put('/api/v1/me/profile')
      .set('x-user-id', '7')
      .send({ coins: 999999 })
      .expect(404);
  });
});

describe('POST /api/v1/me/migrate', () => {
  it('runs once, caps huge coins, opens the wallet, and replays on repeat', async () => {
    const { app, walletLedger } = makeApp({ MIGRATION_MAX_COINS: '1000' });

    const first = await request(app)
      .post('/api/v1/me/migrate')
      .set('x-user-id', '7')
      .send({ sourceVersion: 1, hash: 'abc', profile: { coins: 50000, millionaireWins: 3 } });
    expect(first.status).toBe(201);
    expect(first.body.replayed).toBe(false);
    expect(first.body.record.status).toBe('applied_with_caps');
    expect(first.body.record.accepted.coins).toBe(1000);
    expect(await walletLedger.getBalance('7')).toBe(1000);

    const second = await request(app)
      .post('/api/v1/me/migrate')
      .set('x-user-id', '7')
      .send({ sourceVersion: 1, hash: 'abc', profile: { coins: 50000 } });
    expect(second.status).toBe(200);
    expect(second.body.replayed).toBe(true);
    expect(await walletLedger.getBalance('7')).toBe(1000);
  });
});
