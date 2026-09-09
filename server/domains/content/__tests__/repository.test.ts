import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe } from 'vitest';
import { createSqlContentRepositories } from '../../../infrastructure/database/repositories/content';
import { createTestDatabase, type TestDatabase } from '../../../infrastructure/database/testing';
import { createInMemoryContentRepositories } from '../inMemoryRepository';
import { runContentRepositoryContract } from './repositoryContract';

describe('content repositories — in-memory adapter', () => {
  runContentRepositoryContract(async () => ({
    repos: createInMemoryContentRepositories(),
    reset: async () => {},
  }));
});

describe('content repositories — SQL adapter (pglite)', () => {
  let tdb: TestDatabase;

  beforeAll(async () => {
    tdb = await createTestDatabase();
  });
  afterAll(async () => {
    await tdb.close();
  });

  runContentRepositoryContract(async () => ({
    repos: createSqlContentRepositories(tdb.db),
    reset: async () => {
      await tdb.raw.execute(
        sql`truncate table content_set_items, content_set_versions, content_sets, scripture_references, question_revisions restart identity cascade`,
      );
    },
  }));
});
