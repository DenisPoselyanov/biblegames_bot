import { describe, expect, it } from 'vitest';
import { diffQuestionRevisions } from '../diff';
import type { QuestionRevisionRecord } from '../types';

const base: QuestionRevisionRecord = {
  id: 'qrev_1',
  questionId: 'q1',
  revisionNumber: 1,
  status: 'draft',
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
  contentHash: 'hash1',
  source: 'legacy',
  createdAt: '2026-01-01T00:00:00.000Z',
  createdBy: null,
  supersededAt: null,
  quarantineReason: null,
};

describe('diffQuestionRevisions', () => {
  it('reports no diff for two revisions with identical content fields', () => {
    const result = diffQuestionRevisions(base, { ...base, id: 'qrev_2', revisionNumber: 2 });
    expect(result.changed).toBe(false);
    expect(result.fields).toEqual([]);
  });

  it('reports a diff for a changed text/options field, ignoring bookkeeping fields', () => {
    const after: QuestionRevisionRecord = {
      ...base,
      id: 'qrev_2',
      revisionNumber: 2,
      text: 'Who built the ark, really?',
      options: ['Noah', 'Abraham'],
      contentHash: 'hash2',
    };
    const result = diffQuestionRevisions(base, after);
    expect(result.changed).toBe(true);
    expect(result.fields.map((f) => f.field).sort()).toEqual(['options', 'text']);
  });

  it('treats before: null as a brand-new revision — every field reported', () => {
    const result = diffQuestionRevisions(null, base);
    expect(result.changed).toBe(true);
    expect(result.fields.find((f) => f.field === 'text')).toEqual({
      field: 'text',
      before: null,
      after: 'Who built the ark?',
    });
  });
});
