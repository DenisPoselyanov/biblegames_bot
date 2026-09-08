import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../../config/env';
import { createApp } from '../../app';
import { createMemoryStore } from '../helpers/memoryStore';
import { createMemoryWalletLedger } from '../../wallet';
import { createMemoryIdempotencyStore } from '../../lib/idempotency';
import { createMemoryMigrationStore } from '../../migration/migrationStore';
import { createMemoryAuditLog } from '../../audit';
import { resetRateLimits } from '../../middleware/rateLimit';
import { createSqlRateLimitStore } from '../../infrastructure/database/repositories/rateLimitStore';
import { createTestDatabase, type TestDatabase } from '../../infrastructure/database/testing';

afterEach(() => resetRateLimits());

function makeApp() {
  const { config } = loadConfig({
    NODE_ENV: 'test',
    AUTH_MODE: 'development',
    RATE_LIMIT_DISABLED: 'false',
  });
  return createApp({
    config,
    dbStore: createMemoryStore(),
    walletLedger: createMemoryWalletLedger(),
    idempotency: createMemoryIdempotencyStore(),
    migrationStore: createMemoryMigrationStore(),
    auditLog: createMemoryAuditLog(),
  });
}

describe('rate limiting (§13)', () => {
  it('429s the shop after 15 requests in the window, with Retry-After', async () => {
    const app = makeApp();
    let last = await request(app).post('/api/v1/shop/purchases').set('x-user-id', '7').send({});
    for (let i = 0; i < 14; i += 1) {
      last = await request(app).post('/api/v1/shop/purchases').set('x-user-id', '7').send({});
    }
    // 15 sent so far — all under the limit (they 400 on the empty body, not 429)
    expect(last.status).not.toBe(429);

    const over = await request(app).post('/api/v1/shop/purchases').set('x-user-id', '7').send({});
    expect(over.status).toBe(429);
    expect(over.body.error.code).toBe('rate_limited');
    expect(over.headers['retry-after']).toBeDefined();
    expect(JSON.stringify(over.body)).not.toMatch(/token|secret/i);
  });

  it('limits are per-principal', async () => {
    const app = makeApp();
    for (let i = 0; i < 16; i += 1) {
      await request(app).post('/api/v1/shop/purchases').set('x-user-id', 'a').send({});
    }
    const blocked = await request(app).post('/api/v1/shop/purchases').set('x-user-id', 'a').send({});
    expect(blocked.status).toBe(429);
    const other = await request(app).post('/api/v1/shop/purchases').set('x-user-id', 'b').send({});
    expect(other.status).not.toBe(429);
  });

  it('migrate is capped at 3 per window', async () => {
    const app = makeApp();
    for (let i = 0; i < 3; i += 1) {
      await request(app).post('/api/v1/me/migrate').set('x-user-id', '7').send({ profile: {} });
    }
    const over = await request(app).post('/api/v1/me/migrate').set('x-user-id', '7').send({ profile: {} });
    expect(over.status).toBe(429);
  });
});

describe('rate limiting — shared Postgres store (§13, WS2 part 4)', () => {
  let tdb: TestDatabase;

  beforeAll(async () => {
    tdb = await createTestDatabase();
  });
  afterAll(async () => {
    await tdb.close();
  });

  function persistedApp() {
    const { config } = loadConfig({
      NODE_ENV: 'test',
      AUTH_MODE: 'development',
      RATE_LIMIT_DISABLED: 'false',
    });
    return createApp({
      config,
      dbStore: createMemoryStore(),
      walletLedger: createMemoryWalletLedger(),
      idempotency: createMemoryIdempotencyStore(),
      migrationStore: createMemoryMigrationStore(),
      auditLog: createMemoryAuditLog(),
      rateLimitStore: createSqlRateLimitStore(tdb.db),
    });
  }

  it('429s through the shared store and shares the counter across instances', async () => {
    await createSqlRateLimitStore(tdb.db).reset();
    const a = persistedApp();
    const b = persistedApp(); // a second "instance" on the same database

    for (let i = 0; i < 15; i += 1) {
      await request(a).post('/api/v1/shop/purchases').set('x-user-id', 'shared').send({});
    }
    // Instance B sees A's count — the 16th hit overall is rejected there.
    const over = await request(b).post('/api/v1/shop/purchases').set('x-user-id', 'shared').send({});
    expect(over.status).toBe(429);
    expect(over.headers['retry-after']).toBeDefined();
  });
});
