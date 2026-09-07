import { describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  CONTRACT_VERSION,
  CONTRACT_VERSION_HEADER,
  apiErrorEnvelope,
  meContract,
  shopContract,
} from '../../../contracts/index';
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
  const app = createApp({
    config,
    dbStore,
    walletLedger,
    idempotency: createMemoryIdempotencyStore(),
    migrationStore: createMemoryMigrationStore(),
    auditLog: createMemoryAuditLog(),
  });
  return { app, walletLedger, dbStore };
}

describe('canonical contracts (Phase 2 WS1)', () => {
  it('stamps every response with the contract version header', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/v1/me').set('x-user-id', '7');
    expect(res.headers[CONTRACT_VERSION_HEADER]).toBe(CONTRACT_VERSION);
  });

  it('GET /api/v1/me satisfies meResponse', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/v1/me').set('x-user-id', '7');
    expect(res.status).toBe(200);
    expect(() => meContract.meResponse.parse(res.body)).not.toThrow();
  });

  it('a shop purchase response satisfies purchaseResponse', async () => {
    const { app } = makeApp();
    await request(app)
      .post('/api/v1/progression/completions')
      .set('x-user-id', '7')
      .send({ kind: 'survival', runId: 'fund', idempotencyKey: 'fund-key', score: 500 });
    const res = await request(app)
      .post('/api/v1/shop/purchases')
      .set('x-user-id', '7')
      .send({ kind: 'theme', itemId: 'gennesaret-sea', idempotencyKey: 'buy-key' });
    expect(res.status).toBe(200);
    expect(() => shopContract.purchaseResponse.parse(res.body)).not.toThrow();
  });

  it('rejects an invalid completion with a well-formed error envelope', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/v1/progression/completions')
      .set('x-user-id', '7')
      .send({ kind: 'not-a-kind', idempotencyKey: 'k', runId: 'r' });
    expect(res.status).toBe(400);
    const parsed = apiErrorEnvelope.parse(res.body);
    expect(parsed.error.code).toBe('invalid_completion');
    expect(parsed.error.retryable).toBe(false);
    expect(parsed.error.fieldErrors).toBeTruthy();
    // Phase 1 back-compat projection is still emitted.
    expect(res.body.error.fields).toBeTruthy();
  });

  it('rejects unknown top-level keys on a strict command (§25)', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/v1/shop/purchases')
      .set('x-user-id', '7')
      .send({ kind: 'theme', itemId: 'x', idempotencyKey: 'k1', coins: 999 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_purchase');
  });

  it('marks a rate-limited response retryable', async () => {
    const { app } = makeApp({ RATE_LIMIT_DISABLED: 'false' });
    let last: request.Response | undefined;
    for (let i = 0; i < 25; i += 1) {
      last = await request(app)
        .patch('/api/v1/me/preferences')
        .set('x-user-id', '7')
        .send({ displayName: `n${i}` });
      if (last.status === 429) break;
    }
    expect(last?.status).toBe(429);
    const parsed = apiErrorEnvelope.parse(last!.body);
    expect(parsed.error.code).toBe('rate_limited');
    expect(parsed.error.retryable).toBe(true);
  });

  it('migrateRequest contract matches the route payload shape', () => {
    const ok = meContract.migrateRequest.parse({
      sourceVersion: 1,
      hash: 'abc',
      profile: { coins: 50000, millionaireWins: 3 },
    });
    expect(ok.profile?.coins).toBe(50000);
  });
});
