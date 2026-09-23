import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assessmentRisk, signalBoost } from '../../../../src/lib/contentAssessment';
import { createSqlAssessmentRepository } from '../../../infrastructure/database/repositories/assessments';
import { createTestDatabase, type TestDatabase } from '../../../infrastructure/database/testing';
import { createInMemoryAssessmentRepository } from '../inMemoryAssessments';
import { runAssessmentRepositoryContract } from './assessmentRepositoryContract';

describe('assessment repository — in-memory adapter', () => {
  runAssessmentRepositoryContract(async () => ({ repo: createInMemoryAssessmentRepository(), reset: async () => {} }));
});

describe('assessment repository — SQL adapter (pglite)', () => {
  let tdb: TestDatabase;
  beforeAll(async () => {
    tdb = await createTestDatabase();
  });
  afterAll(async () => {
    await tdb.close();
  });

  runAssessmentRepositoryContract(async () => ({
    repo: createSqlAssessmentRepository(tdb.db),
    reset: async () => {
      await tdb.raw.execute(sql`truncate table question_assessments`);
    },
  }));
});

describe('assessment risk (content quality gate)', () => {
  const pass = {
    answer_supported: 'pass',
    single_correct: 'pass',
    factual: 'pass',
    distractors: 'pass',
    topic_fit: 'pass',
    level_fit: 'pass',
    explanation_fit: 'pass',
    language: 'pass',
  } as const;

  it('ranks a hallucination above a wrong level above a confident pass', () => {
    const reject = assessmentRisk({ verdict: 'reject', criteria: { ...pass, factual: 'fail', answer_supported: 'fail' }, confidence: 0.9 });
    const reclassify = assessmentRisk({ verdict: 'reclassify', criteria: { ...pass, level_fit: 'fail' }, confidence: 0.9 });
    const confidentPass = assessmentRisk({ verdict: 'pass', criteria: pass, confidence: 0.95 });
    const unsurePass = assessmentRisk({ verdict: 'pass', criteria: { ...pass, single_correct: 'unsure' }, confidence: 0.4 });
    expect(reject).toBeGreaterThan(reclassify);
    expect(reclassify).toBeGreaterThan(unsurePass);
    expect(unsurePass).toBeGreaterThan(confidentPass);
    expect(reject).toBeLessThanOrEqual(200);
  });

  it('adds player signals on top (layer 4)', () => {
    expect(signalBoost({})).toBe(0);
    expect(signalBoost({ openReports: 2, wrongAnswerReports: 1, accuracyBand: 'too_hard' })).toBe(20 + 15 + 25);
    expect(signalBoost({ openReports: 99, wrongAnswerReports: 99 })).toBe(70);
  });
});
