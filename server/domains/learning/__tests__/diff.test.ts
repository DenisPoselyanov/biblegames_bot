import { describe, expect, it } from 'vitest';
import { diffLessonRevisions } from '../diff';
import type { LessonRevisionRecord } from '../types';

const base: LessonRevisionRecord = {
  id: 'lrev_1',
  lessonId: 'lesson_genesis-creation',
  revisionNumber: 1,
  status: 'draft',
  planId: 'genesis',
  moduleId: 'genesis-sub-1',
  objectiveId: 'genesis-sub-1-sub-1',
  title: 'Створення світу',
  description: null,
  blocks: [{ id: 'b1', blockType: 'heading', schemaVersion: 1, payload: { text: 'Створення світу' } }],
  contentHash: 'hash1',
  source: 'authored',
  createdAt: '2026-01-01T00:00:00.000Z',
  createdBy: null,
  supersededAt: null,
  quarantineReason: null,
};

describe('diffLessonRevisions', () => {
  it('reports no diff for two revisions with identical content fields', () => {
    const result = diffLessonRevisions(base, { ...base, id: 'lrev_2', revisionNumber: 2 });
    expect(result.changed).toBe(false);
    expect(result.fields).toEqual([]);
  });

  it('reports a diff for a changed title/blocks field, ignoring bookkeeping fields', () => {
    const after: LessonRevisionRecord = {
      ...base,
      id: 'lrev_2',
      revisionNumber: 2,
      title: 'Створення світу (оновлено)',
      blocks: [
        ...base.blocks,
        { id: 'b2', blockType: 'explanation', schemaVersion: 1, payload: { text: '...' } },
      ],
      contentHash: 'hash2',
    };
    const result = diffLessonRevisions(base, after);
    expect(result.changed).toBe(true);
    expect(result.fields.map((f) => f.field).sort()).toEqual(['blocks', 'title']);
  });

  it('treats before: null as a brand-new revision — every field reported', () => {
    const result = diffLessonRevisions(null, base);
    expect(result.changed).toBe(true);
    expect(result.fields.find((f) => f.field === 'title')).toEqual({
      field: 'title',
      before: null,
      after: 'Створення світу',
    });
  });
});
