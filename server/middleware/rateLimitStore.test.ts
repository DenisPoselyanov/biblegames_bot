import { afterAll, beforeAll, describe } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../infrastructure/database/testing';
import { createSqlRateLimitStore } from '../infrastructure/database/repositories/rateLimitStore';
import { createMemoryRateLimitStore } from './rateLimitStore';
import { runRateLimitStoreContract } from './rateLimitStoreContract';

describe('rate-limit store — in-memory adapter', () => {
  runRateLimitStoreContract(async () => {
    let ms = 1_000_000;
    const store = createMemoryRateLimitStore({ now: () => ms, sweepMs: 0 });
    return {
      store,
      clock: () => ms,
      advance: (delta) => {
        ms += delta;
      },
      reset: () => store.reset(),
    };
  });
});

describe('rate-limit store — Postgres adapter (pglite)', () => {
  let tdb: TestDatabase;

  beforeAll(async () => {
    tdb = await createTestDatabase();
  });
  afterAll(async () => {
    await tdb.close();
  });

  runRateLimitStoreContract(async () => {
    let ms = 1_000_000;
    const store = createSqlRateLimitStore(tdb.db, { now: () => new Date(ms) });
    return {
      store,
      clock: () => ms,
      advance: (delta) => {
        ms += delta;
      },
      reset: () => store.reset() as Promise<void>,
    };
  });
});
