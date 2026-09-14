import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe } from 'vitest';
import { createSqlLearningRepositories } from '../../../infrastructure/database/repositories/learning';
import { createTestDatabase, type TestDatabase } from '../../../infrastructure/database/testing';
import { createInMemoryLearningRepositories } from '../inMemoryRepository';
import { runLearningRepositoryContract } from './repositoryContract';

describe('learning repositories — in-memory adapter', () => {
  runLearningRepositoryContract(async () => ({
    repos: createInMemoryLearningRepositories(),
    reset: async () => {},
  }));
});

describe('learning repositories — SQL adapter (pglite)', () => {
  let tdb: TestDatabase;

  beforeAll(async () => {
    tdb = await createTestDatabase();
  });
  afterAll(async () => {
    await tdb.close();
  });

  runLearningRepositoryContract(async () => ({
    repos: createSqlLearningRepositories(tdb.db),
    reset: async () => {
      await tdb.raw.execute(
        sql`truncate table lesson_blocks, lessons, learning_objectives, learning_modules, learning_plans restart identity cascade`,
      );
    },
  }));
});
