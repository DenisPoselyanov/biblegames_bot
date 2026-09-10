import { afterAll, beforeAll, describe } from 'vitest';
import { sql } from 'drizzle-orm';
import { createTestDatabase, type TestDatabase } from '../../../infrastructure/database/testing';
import { createSqlEconomyRepositories } from '../../../infrastructure/database/repositories/economy';
import { createInMemoryEconomyRepositories } from '../inMemoryRepository';
import { runEconomyRepositoryContract } from './repositoryContract';

describe('economy repositories — in-memory adapter', () => {
  runEconomyRepositoryContract(async () => ({
    repos: createInMemoryEconomyRepositories(),
    ensureUser: async () => {},
    reset: async () => {},
  }));
});

describe('economy repositories — SQL adapter (pglite)', () => {
  let tdb: TestDatabase;

  beforeAll(async () => {
    tdb = await createTestDatabase();
  });
  afterAll(async () => {
    await tdb.close();
  });

  runEconomyRepositoryContract(async () => ({
    repos: createSqlEconomyRepositories(tdb.db),
    ensureUser: async (id: string) => {
      await tdb.raw.execute(
        sql`insert into users (id) values (${id}) on conflict (id) do nothing`,
      );
    },
    reset: async () => {
      await tdb.raw.execute(sql`truncate table entitlements, users restart identity cascade`);
    },
  }));
});
