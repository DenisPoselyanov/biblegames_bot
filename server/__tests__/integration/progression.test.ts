import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../../config/env';
import { createApp } from '../../app';
import { createMemoryWalletLedger } from '../../wallet';
import { createMemoryIdempotencyStore } from '../../lib/idempotency';
import { createMemoryMigrationStore } from '../../migration/migrationStore';
import { createMemoryAuditLog } from '../../audit';
import { createMemoryStore } from '../helpers/memoryStore';

afterEach(() => {
  delete process.env.FEATURE_AUTHORITATIVEPROFILEV2;
  delete process.env.FEATURE_DISABLELEGACYPROFILEWRITES;
});

function makeApp(env: Record<string, string> = {}) {
  const { config } = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'development', ...env });
  const walletLedger = createMemoryWalletLedger();
  const deps = {
    config,
    dbStore: createMemoryStore(),
    walletLedger,
    idempotency: createMemoryIdempotencyStore(),
    migrationStore: createMemoryMigrationStore(),
    auditLog: createMemoryAuditLog(),
  };
  return { app: createApp(deps), walletLedger };
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
  it('404s when the flag is off (default)', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/v1/progression/completions')
      .set('x-user-id', '7')
      .send(level());
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_enabled');
  });

  it('grants coins once and returns a stable eventId', async () => {
    process.env.FEATURE_AUTHORITATIVEPROFILEV2 = 'true';
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
    process.env.FEATURE_AUTHORITATIVEPROFILEV2 = 'true';
    const { app, walletLedger } = makeApp();
    const a = await request(app).post('/api/v1/progression/completions').set('x-user-id', '7').send(level());
    const b = await request(app).post('/api/v1/progression/completions').set('x-user-id', '7').send(level());
    expect(b.body.eventId).toBe(a.body.eventId);
    expect(await walletLedger.getBalance('7')).toBe(15);
  });

  it('grants once under a concurrent double-submit', async () => {
    process.env.FEATURE_AUTHORITATIVEPROFILEV2 = 'true';
    const { app, walletLedger } = makeApp();
    await Promise.all([
      request(app).post('/api/v1/progression/completions').set('x-user-id', '7').send(level()),
      request(app).post('/api/v1/progression/completions').set('x-user-id', '7').send(level()),
    ]);
    expect(await walletLedger.getBalance('7')).toBe(15);
  });

  it('rejects correctCount > totalQuestions', async () => {
    process.env.FEATURE_AUTHORITATIVEPROFILEV2 = 'true';
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/v1/progression/completions')
      .set('x-user-id', '7')
      .send(level({ correctCount: 9 }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_completion');
  });
});

describe('preference / progression write split', () => {
  it('PATCH /api/v1/me/preferences changes only whitelisted fields', async () => {
    const { app } = makeApp();
    // seed an owned theme so activeTheme is accepted
    await request(app)
      .put('/api/v1/me/profile')
      .set('x-user-id', '7')
      .send({ unlockedThemes: ['dawn'], displayName: 'old' });

    const res = await request(app)
      .patch('/api/v1/me/preferences')
      .set('x-user-id', '7')
      .send({ displayName: 'Grace', activeTheme: 'dawn', coins: 99999 });
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Grace');
    expect(res.body.activeTheme).toBe('dawn');
    expect(res.body.coins).not.toBe(99999);
  });

  it('with the flag on, PUT /api/v1/me/profile ignores authoritative fields', async () => {
    process.env.FEATURE_AUTHORITATIVEPROFILEV2 = 'true';
    const { app } = makeApp();
    await request(app)
      .put('/api/v1/me/profile')
      .set('x-user-id', '7')
      .send({ coins: 999999, displayName: 'Grace' })
      .expect(200);
    const profile = await request(app).get('/api/v1/me/profile').set('x-user-id', '7');
    expect(profile.body.coins).toBe(0);
    expect(profile.body.displayName).toBe('Grace');
  });

  it('FEATURE_DISABLELEGACYPROFILEWRITES=true refuses PUT /profile/:id', async () => {
    process.env.FEATURE_DISABLELEGACYPROFILEWRITES = 'true';
    const { app } = makeApp();
    const res = await request(app).put('/profile/7').set('x-user-id', '7').send({ displayName: 'x' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('legacy_profile_write_disabled');
  });
});

describe('POST /api/v1/me/migrate', () => {
  it('runs once, caps huge coins, opens the wallet, and replays on repeat', async () => {
    process.env.FEATURE_AUTHORITATIVEPROFILEV2 = 'true';
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

  it('404s when the flag is off', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/api/v1/me/migrate').set('x-user-id', '7').send({ profile: {} });
    expect(res.status).toBe(404);
  });
});
