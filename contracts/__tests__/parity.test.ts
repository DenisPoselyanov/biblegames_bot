import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../../src/types/index';
import { DIFFICULTY_VALUES, apiErrorEnvelope, difficultySchema } from '../index';
import { completionRequest } from '../api/progression';

/**
 * Contract ↔ legacy-type parity (Phase 2 §25 "sharing frontend types as
 * unvalidated server contracts"). Until Phase 3 moves the client onto
 * `@contracts`, the literal unions in `src/types/index.ts` must not drift from
 * the schema vocabularies here.
 */
describe('contract parity with src/types', () => {
  it('difficulty vocabulary matches src/types DIFFICULTIES', () => {
    expect([...DIFFICULTY_VALUES]).toEqual([...DIFFICULTIES]);
  });
});

describe('error envelope (§7.5)', () => {
  it('accepts a minimal valid envelope and defaults retryable to false', () => {
    const parsed = apiErrorEnvelope.parse({ error: { code: 'x', message: 'y' } });
    expect(parsed.error.retryable).toBe(false);
  });

  it('rejects an envelope with no code', () => {
    expect(() => apiErrorEnvelope.parse({ error: { message: 'y' } })).toThrow();
  });
});

describe('completion request', () => {
  it('rejects an unknown kind', () => {
    expect(
      () => completionRequest.parse({ kind: 'nope', idempotencyKey: 'abcdefgh', runId: 'r1' }),
    ).toThrow();
  });

  it('rejects unknown top-level keys (strict)', () => {
    expect(() =>
      completionRequest.parse({
        kind: 'level',
        idempotencyKey: 'abcdefgh',
        runId: 'r1',
        coins: 999,
      }),
    ).toThrow();
  });

  it('accepts a well-formed level completion', () => {
    const ok = completionRequest.parse({
      kind: 'level',
      idempotencyKey: 'abcdefgh12',
      runId: 'run-1',
      difficulty: 'child',
      correctCount: 6,
      totalQuestions: 7,
    });
    expect(ok.kind).toBe('level');
  });

  it('difficultySchema is the same enum', () => {
    expect(difficultySchema.parse('theologian')).toBe('theologian');
  });
});
