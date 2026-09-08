import { afterAll, beforeAll, describe } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../infrastructure/database/testing';
import { createSqlIdentityRepositories } from '../../../infrastructure/database/repositories/identity';
import { sql } from 'drizzle-orm';
import { createInMemoryIdentityRepositories } from '../inMemoryRepository';
import { runIdentityRepositoryContract } from './repositoryContract';

describe('identity repositories — in-memory adapter', () => {
  runIdentityRepositoryContract(async () => ({
    repos: createInMemoryIdentityRepositories(),
    reset: async () => {},
  }));
});

describe('identity repositories — SQL adapter (pglite)', () => {
  let tdb: TestDatabase;

  beforeAll(async () => {
    tdb = await createTestDatabase();
  });
  afterAll(async () => {
    await tdb.close();
  });

  runIdentityRepositoryContract(async () => ({
    repos: createSqlIdentityRepositories(tdb.db),
    reset: async () => {
      await tdb.raw.execute(
        sql`truncate table user_roles, external_identities, user_preferences, users restart identity cascade`,
      );
    },
  }));
});
