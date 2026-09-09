import { describe, expect, it } from 'vitest';
import {
  contentSetFilter,
  publishedContentSet,
  publishedQuestion,
  questionRevision,
  scriptureReference,
} from '../schemas/content';

/** Phase 2 §14 — the canonical content read contract. */
describe('questionRevision', () => {
  const base = {
    id: 'qrev_1',
    questionId: 'q1',
    revisionNumber: 1,
    status: 'legacy_unreviewed' as const,
    themeId: 'genesis',
    difficulty: 'youth' as const,
    text: 'Who built the ark?',
    options: ['Noah', 'Moses'],
    correctIndex: 0,
    contentHash: 'a'.repeat(64),
    createdAt: '2026-09-09T00:00:00.000Z',
  };

  it('accepts a minimal legacy revision and fills defaults', () => {
    const parsed = questionRevision.parse(base);
    expect(parsed.scriptureRefs).toEqual([]);
    expect(parsed.source).toBe('legacy');
    expect(parsed.topicNodeId).toBeNull();
  });

  it('rejects correctIndex out of range for the options given (§14 — no first-option fallback)', () => {
    expect(() => questionRevision.parse({ ...base, correctIndex: 5 })).toThrow();
  });

  it('rejects fewer than two options', () => {
    expect(() => questionRevision.parse({ ...base, options: ['Noah'] })).toThrow();
  });

  it('rejects a non-sha256 contentHash', () => {
    expect(() => questionRevision.parse({ ...base, contentHash: 'nope' })).toThrow();
  });

  it('rejects unknown keys (strict)', () => {
    expect(() => questionRevision.parse({ ...base, sneaky: true })).toThrow();
  });
});

describe('scriptureReference', () => {
  it('defaults verseEnd and translation to null', () => {
    const parsed = scriptureReference.parse({ book: 'John', chapter: 3, verseStart: 16 });
    expect(parsed.verseEnd).toBeNull();
    expect(parsed.translation).toBeNull();
  });
});

describe('publishedContentSet', () => {
  it('requires a known kind and a stable hash', () => {
    const ok = publishedContentSet.parse({
      setId: 'quiz:genesis',
      kind: 'quiz',
      version: 3,
      contentHash: 'b'.repeat(64),
      filter: contentSetFilter.parse({ themeIds: ['genesis'] }),
      questionCount: 2,
      questionIds: ['q1', 'q2'],
      publishedAt: '2026-09-09T00:00:00.000Z',
    });
    expect(ok.version).toBe(3);
    expect(() => publishedContentSet.parse({ ...ok, kind: 'trivia' })).toThrow();
  });
});

describe('publishedQuestion', () => {
  it('is the read projection consumers receive', () => {
    const parsed = publishedQuestion.parse({
      id: 'q1',
      revisionId: 'qrev_1',
      revisionNumber: 1,
      themeId: 'genesis',
      difficulty: 'youth',
      topicNodeId: null,
      topicPath: null,
      text: 'Who built the ark?',
      options: ['Noah', 'Moses'],
      correctIndex: 0,
      explanationShort: null,
      explanationDeep: null,
      reference: null,
      scriptureRefs: [],
      tags: [],
    });
    expect(parsed.id).toBe('q1');
  });
});
