import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe } from 'vitest';
import { createSqlScriptureEvidenceRepository } from '../../../infrastructure/database/repositories/scriptureEvidence';
import { createTestDatabase, type TestDatabase } from '../../../infrastructure/database/testing';
import { createInMemoryScriptureEvidenceRepository } from '../inMemoryScriptureEvidence';
import { runScriptureEvidenceRepositoryContract } from './scriptureEvidenceRepositoryContract';

describe('scripture-evidence repository — in-memory adapter', () => {
  runScriptureEvidenceRepositoryContract(async () => ({
    repo: createInMemoryScriptureEvidenceRepository(),
    reset: async () => {},
  }));
});

describe('scripture-evidence repository — SQL adapter (pglite)', () => {
  let tdb: TestDatabase;

  beforeAll(async () => {
    tdb = await createTestDatabase();
  });
  afterAll(async () => {
    await tdb.close();
  });

  runScriptureEvidenceRepositoryContract(async () => ({
    repo: createSqlScriptureEvidenceRepository(tdb.db),
    reset: async () => {
      await tdb.raw.execute(sql`truncate table scripture_evidence restart identity cascade`);
    },
  }));
});
