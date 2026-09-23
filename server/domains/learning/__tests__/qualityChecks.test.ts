import { describe, expect, it } from 'vitest';
import { runLessonQualityChecks } from '../qualityChecks';
import type { LessonBody } from '../qualityChecks';
import type { LessonRevisionBlock } from '../types';

const block = (over: Partial<LessonRevisionBlock> = {}): LessonRevisionBlock => ({
  id: 'b1',
  blockType: 'heading',
  schemaVersion: 1,
  payload: { text: 'Створення світу' },
  ...over,
});

const lessonBody = (over: Partial<LessonBody> = {}): LessonBody => ({
  lessonId: 'lesson_1',
  objectiveId: 'obj_1',
  title: 'Створення світу',
  blocks: [
    block({ id: 'b1', blockType: 'heading', payload: { text: 'Створення світу' } }),
    block({ id: 'b2', blockType: 'text', payload: { text: 'На початку Бог створив небо і землю.' } }),
    block({ id: 'b3', blockType: 'reveal', payload: { front: 'Скільки днів тривало створення?', back: 'Шість, а сьомого Бог спочив.' } }),
    block({ id: 'b4', blockType: 'summary', payload: { text: 'Підсумок уроку.' } }),
  ],
  ...over,
});

describe('runLessonQualityChecks — structure', () => {
  it('returns no findings for a well-formed lesson', () => {
    expect(runLessonQualityChecks(lessonBody())).toEqual([]);
  });

  it('warns when a lesson has no interactive block', () => {
    const findings = runLessonQualityChecks(
      lessonBody({
        blocks: [
          block({ id: 'b1', blockType: 'heading', payload: { text: 'A' } }),
          block({ id: 'b2', blockType: 'summary', payload: { text: 'B' } }),
        ],
      }),
    );
    expect(findings).toEqual([expect.objectContaining({ kind: 'missing_interactive_block', severity: 'warning' })]);
  });

  it('flags a malformed interactive payload as blocking', () => {
    const findings = runLessonQualityChecks(
      lessonBody({
        blocks: [
          block({ id: 'b1', blockType: 'order_events', payload: { prompt: 'Розстав', items: ['Один', 'Два'] } }),
          block({ id: 'b2', blockType: 'summary', payload: { text: 'B' } }),
        ],
      }),
    );
    expect(findings).toContainEqual(expect.objectContaining({ kind: 'malformed_block_payload', severity: 'blocking' }));
  });

  it('flags an empty block list as blocking and skips other structural checks', () => {
    const findings = runLessonQualityChecks(lessonBody({ blocks: [] }));
    expect(findings).toEqual([
      expect.objectContaining({ kind: 'empty_lesson', severity: 'blocking' }),
    ]);
  });

  it('flags a duplicate block id as blocking', () => {
    const findings = runLessonQualityChecks(
      lessonBody({
        blocks: [
          block({ id: 'b1', blockType: 'heading', payload: { text: 'A' } }),
          block({ id: 'b1', blockType: 'text', payload: { text: 'B' } }),
          block({ id: 'b3', blockType: 'summary', payload: { text: 'C' } }),
        ],
      }),
    );
    expect(findings).toContainEqual(
      expect.objectContaining({ kind: 'duplicate_block_id', severity: 'blocking' }),
    );
  });

  it('flags an unknown blockType as blocking', () => {
    const findings = runLessonQualityChecks(
      lessonBody({
        blocks: [block({ id: 'b1', blockType: 'made_up_type' as LessonRevisionBlock['blockType'] })],
      }),
    );
    expect(findings).toContainEqual(
      expect.objectContaining({ kind: 'unknown_block_type', severity: 'blocking' }),
    );
  });

  it('flags a block payload that fails its schema as blocking', () => {
    const findings = runLessonQualityChecks(
      lessonBody({
        blocks: [
          block({ id: 'b1', blockType: 'scripture', payload: { reference: 'Ів 3:16' } }), // missing translation/text
          block({ id: 'b3', blockType: 'summary', payload: { text: 'Підсумок.' } }),
        ],
      }),
    );
    expect(findings).toContainEqual(
      expect.objectContaining({ kind: 'malformed_block_payload', severity: 'blocking' }),
    );
  });

  it('accepts a well-formed scripture block payload', () => {
    const findings = runLessonQualityChecks(
      lessonBody({
        blocks: [
          block({
            id: 'b1',
            blockType: 'scripture',
            payload: { reference: 'Ів 3:16', translation: 'УБТ', text: 'Так бо Бог полюбив світ...' },
          }),
          block({ id: 'b3', blockType: 'summary', payload: { text: 'Підсумок.' } }),
        ],
      }),
    );
    expect(findings.find((f) => f.kind === 'malformed_block_payload')).toBeUndefined();
  });

  it('flags a missing summary block as a warning, not blocking', () => {
    const findings = runLessonQualityChecks(
      lessonBody({ blocks: [block({ id: 'b1', blockType: 'heading', payload: { text: 'A' } })] }),
    );
    expect(findings).toContainEqual(
      expect.objectContaining({ kind: 'missing_required_block', severity: 'warning' }),
    );
  });
});

describe('runLessonQualityChecks — objective mapping', () => {
  it('flags an unknown objectiveId only when knownObjectiveIds is supplied', () => {
    const withoutContext = runLessonQualityChecks(lessonBody({ objectiveId: 'nonexistent' }));
    expect(withoutContext.find((f) => f.kind === 'orphan_objective')).toBeUndefined();

    const withContext = runLessonQualityChecks(lessonBody({ objectiveId: 'nonexistent' }), {
      knownObjectiveIds: ['obj_1', 'obj_2'],
    });
    expect(withContext).toContainEqual(
      expect.objectContaining({ kind: 'orphan_objective', severity: 'blocking' }),
    );
  });

  it('still checks orphan objective even when the lesson has no blocks', () => {
    const findings = runLessonQualityChecks(lessonBody({ blocks: [], objectiveId: 'nonexistent' }), {
      knownObjectiveIds: ['obj_1'],
    });
    expect(findings.map((f) => f.kind).sort()).toEqual(['empty_lesson', 'orphan_objective']);
  });
});
