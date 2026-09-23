import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe } from 'vitest';
import { createSqlQualityRepositories } from '../../../infrastructure/database/repositories/quality';
import { createTestDatabase, type TestDatabase } from '../../../infrastructure/database/testing';
import { createInMemoryQualityRepositories } from '../inMemory';
import { runQualityRepositoryContract } from './qualityRepositoryContract';

describe('quality repositories — in-memory adapter', () => {
  runQualityRepositoryContract(async () => {
    const answers: Array<{ questionId: string; isCorrect: boolean }> = [];
    return {
      repos: createInMemoryQualityRepositories({ answers: async () => answers }),
      seedAnswer: async (questionId, isCorrect) => {
        answers.push({ questionId, isCorrect });
      },
      reset: async () => {},
    };
  });
});

describe('quality repositories — SQL adapter (pglite)', () => {
  let tdb: TestDatabase;
  let seq = 0;

  beforeAll(async () => {
    tdb = await createTestDatabase();
  });
  afterAll(async () => {
    await tdb.close();
  });

  runQualityRepositoryContract(async () => ({
    repos: createSqlQualityRepositories(tdb.db),
    seedAnswer: async (questionId, isCorrect) => {
      seq += 1;
      await tdb.client.query(
        `insert into study_answers (user_id, question_id, subtheme_id, is_correct, answered_at, idempotency_key)
         values ($1, $2, 'sub', $3, now(), $4)`,
        [`u${seq}`, questionId, isCorrect, `k${seq}`],
      );
    },
    reset: async () => {
      await tdb.raw.execute(sql`truncate table content_reports, question_option_picks, study_answers restart identity cascade`);
    },
  }));
});
