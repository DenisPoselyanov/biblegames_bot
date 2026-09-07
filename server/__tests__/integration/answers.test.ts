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
});

function makeApp(env: Record<string, string> = {}) {
  const { config } = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'development', ...env });
  const dbStore = createMemoryStore();
  const app = createApp({
    config,
    dbStore,
    walletLedger: createMemoryWalletLedger(),
    idempotency: createMemoryIdempotencyStore(),
    migrationStore: createMemoryMigrationStore(),
    auditLog: createMemoryAuditLog(),
  });
  return { app, dbStore };
}

const answer = (overrides: Record<string, unknown> = {}) => ({
  questionId: 'q1',
  themeId: 'gospels',
  nodeId: 'gospels-life',
  isCorrect: true,
  idempotencyKey: 'a1',
  ...overrides,
});

describe('POST /api/v1/progression/answers', () => {
  it('404s when the flag is off', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/api/v1/progression/answers').set('x-user-id', '7').send(answer());
    expect(res.status).toBe(404);
  });

  it('raises mastery for the node and records the answer', async () => {
    process.env.FEATURE_AUTHORITATIVEPROFILEV2 = 'true';
    const { app } = makeApp();
    const res = await request(app).post('/api/v1/progression/answers').set('x-user-id', '7').send(answer());
    expect(res.status).toBe(200);
    expect(res.body.nodeId).toBe('gospels-life');
    expect(res.body.mastery.mastery).toBeGreaterThan(0);

    const profile = await request(app).get('/api/v1/me/profile').set('x-user-id', '7');
    expect(profile.body.studyMastery['gospels-life'].totalAnswers).toBe(1);

    const history = await request(app).get('/api/v1/me/study/answers').set('x-user-id', '7');
    expect(history.body).toHaveLength(1);
    expect(history.body[0].questionId).toBe('q1');
  });

  it('is idempotent on idempotencyKey', async () => {
    process.env.FEATURE_AUTHORITATIVEPROFILEV2 = 'true';
    const { app } = makeApp();
    await request(app).post('/api/v1/progression/answers').set('x-user-id', '7').send(answer());
    await request(app).post('/api/v1/progression/answers').set('x-user-id', '7').send(answer());
    const profile = await request(app).get('/api/v1/me/profile').set('x-user-id', '7');
    expect(profile.body.studyMastery['gospels-life'].totalAnswers).toBe(1);
  });

  it('grants mastery-expert only once mastery reaches 100', async () => {
    process.env.FEATURE_AUTHORITATIVEPROFILEV2 = 'true';
    const { app } = makeApp();
    let granted: string[] = [];
    for (let i = 0; i < 30; i += 1) {
      const res = await request(app)
        .post('/api/v1/progression/answers')
        .set('x-user-id', '7')
        .send(answer({ idempotencyKey: `a${i}`, questionId: `q${i}` }));
      granted = granted.concat(res.body.achievementsGranted ?? []);
    }
    expect(granted).toContain('mastery-expert');
    const profile = await request(app).get('/api/v1/me/profile').set('x-user-id', '7');
    expect(profile.body.achievements.filter((a: string) => a === 'mastery-expert')).toHaveLength(1);
  });

  it('400s on a missing idempotencyKey', async () => {
    process.env.FEATURE_AUTHORITATIVEPROFILEV2 = 'true';
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/v1/progression/answers')
      .set('x-user-id', '7')
      .send(answer({ idempotencyKey: '' }));
    expect(res.status).toBe(400);
  });
});
