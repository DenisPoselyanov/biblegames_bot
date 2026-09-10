import { afterAll, beforeAll, describe } from 'vitest';
import { sql } from 'drizzle-orm';
import { createTestDatabase, type TestDatabase } from '../../../infrastructure/database/testing';
import { createSqlProgressionRepositories } from '../../../infrastructure/database/repositories/progression';
import { createInMemoryProgressionRepositories } from '../inMemoryRepository';
import { runProgressionRepositoryContract } from './repositoryContract';

describe('progression repositories — in-memory adapter', () => {
  runProgressionRepositoryContract(async () => ({
    repos: createInMemoryProgressionRepositories(),
    ensureUser: async () => {},
    reset: async () => {},
  }));
});

describe('progression repositories — SQL adapter (pglite)', () => {
  let tdb: TestDatabase;

  beforeAll(async () => {
    tdb = await createTestDatabase();
  });
  afterAll(async () => {
    await tdb.close();
  });

  runProgressionRepositoryContract(async () => ({
    repos: createSqlProgressionRepositories(tdb.db),
    ensureUser: async (id: string) => {
      await tdb.raw.execute(
        sql`insert into users (id) values (${id}) on conflict (id) do nothing`,
      );
    },
    reset: async () => {
      await tdb.raw.execute(
        sql`truncate table progression_state, achievement_grants, player_theme_stats, users restart identity cascade`,
      );
    },
  }));
});
