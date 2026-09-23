import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe } from 'vitest';
import { createSqlValidationFindingRepository } from '../../../infrastructure/database/repositories/validationFindings';
import { createTestDatabase, type TestDatabase } from '../../../infrastructure/database/testing';
import { createInMemoryValidationFindingRepository } from '../inMemoryValidationFindings';
import { runValidationFindingsRepositoryContract } from './validationFindingsRepositoryContract';

describe('validation-finding repository — in-memory adapter', () => {
  runValidationFindingsRepositoryContract(async () => ({
    repo: createInMemoryValidationFindingRepository(),
    reset: async () => {},
  }));
});

describe('validation-finding repository — SQL adapter (pglite)', () => {
  let tdb: TestDatabase;

  beforeAll(async () => {
    tdb = await createTestDatabase();
  });
  afterAll(async () => {
    await tdb.close();
  });

  runValidationFindingsRepositoryContract(async () => ({
    repo: createSqlValidationFindingRepository(tdb.db),
    reset: async () => {
      await tdb.raw.execute(sql`truncate table content_validation_findings restart identity cascade`);
    },
  }));
});
