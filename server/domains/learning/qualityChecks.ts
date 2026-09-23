/**
 * Structural quality checks for a lesson revision (Phase 4 WS3, spec §5.3).
 * Pure functions — no repository, no I/O — mirrors `content/qualityChecks.ts`.
 *
 * Every `lesson_blocks`/`lesson_revisions` row previously landed its `payload`
 * as an unvalidated `jsonb` blob (§0 of the execution plan: "no payload-shape
 * validation before"). This is the first point that checks a block's payload
 * against the schema the client renderer already assumes
 * (`contracts/schemas/lessonBlocks.ts`, formerly duplicated only on the
 * client at `src/components/learn/lessonBlockPayloads.ts`).
 */
import { INTERACTIVE_LESSON_BLOCK_TYPES, LESSON_BLOCK_PAYLOAD_SCHEMAS } from '../../../contracts/index';
import type { NewValidationFinding } from '../shared/validationFindings';
import type { LessonRevisionBlock } from './types';

export interface LessonBody {
  lessonId: string;
  objectiveId: string;
  title: string;
  blocks: LessonRevisionBlock[];
}

export interface LessonQualityCheckContext {
  /** Objective ids the caller knows to be real. Omitted → the orphan-objective check is skipped. */
  knownObjectiveIds?: readonly string[];
}

function emptyLessonCheck(body: LessonBody): NewValidationFinding[] {
  if (body.blocks.length > 0) return [];
  return [
    {
      revisionType: 'lesson',
      revisionId: body.lessonId,
      kind: 'empty_lesson',
      severity: 'blocking',
      label: 'Урок без блоків',
      detail: 'Список blocks порожній.',
    },
  ];
}

function duplicateBlockIdCheck(body: LessonBody): NewValidationFinding[] {
  const seen = new Set<string>();
  for (const block of body.blocks) {
    if (seen.has(block.id)) {
      return [
        {
          revisionType: 'lesson',
          revisionId: body.lessonId,
          kind: 'duplicate_block_id',
          severity: 'blocking',
          label: 'Повторюваний id блоку',
          detail: `Блок «${block.id}» зустрічається двічі — порядок блоків стає невизначеним.`,
        },
      ];
    }
    seen.add(block.id);
  }
  return [];
}

function unknownBlockTypeCheck(body: LessonBody): NewValidationFinding[] {
  const findings: NewValidationFinding[] = [];
  for (const block of body.blocks) {
    if (!(block.blockType in LESSON_BLOCK_PAYLOAD_SCHEMAS)) {
      findings.push({
        revisionType: 'lesson',
        revisionId: body.lessonId,
        kind: 'unknown_block_type',
        severity: 'blocking',
        label: 'Невідомий тип блоку',
        detail: `Блок «${block.id}» має blockType «${block.blockType}», якого немає в LESSON_BLOCK_TYPES.`,
      });
    }
  }
  return findings;
}

/** Every block whose `blockType` is known gets its `payload` checked against the shared zod schema (§11.3). */
function malformedPayloadCheck(body: LessonBody): NewValidationFinding[] {
  const findings: NewValidationFinding[] = [];
  for (const block of body.blocks) {
    const schema = (LESSON_BLOCK_PAYLOAD_SCHEMAS as Record<string, { safeParse: (v: unknown) => { success: boolean } }>)[
      block.blockType
    ];
    if (!schema) continue; // unknown-block-type finding already covers this block
    const result = schema.safeParse(block.payload);
    if (!result.success) {
      findings.push({
        revisionType: 'lesson',
        revisionId: body.lessonId,
        kind: 'malformed_block_payload',
        severity: 'blocking',
        label: 'Некоректний вміст блоку',
        detail: `Блок «${block.id}» (${block.blockType}) не відповідає очікуваній структурі.`,
      });
    }
  }
  return findings;
}

const REQUIRED_BLOCK_TYPES: LessonRevisionBlock['blockType'][] = ['summary'];

function missingRequiredBlocksCheck(body: LessonBody): NewValidationFinding[] {
  const present = new Set(body.blocks.map((b) => b.blockType));
  const missing = REQUIRED_BLOCK_TYPES.filter((t) => !present.has(t));
  if (missing.length === 0) return [];
  return [
    {
      revisionType: 'lesson',
      revisionId: body.lessonId,
      kind: 'missing_required_block',
      severity: 'warning',
      label: 'Бракує підсумкового блоку',
      detail: `Урок не має блоку типу: ${missing.join(', ')}.`,
    },
  ];
}

/** A lesson made only of reading blocks — flagged so every lesson asks the reader to do something at least once. */
function missingInteractiveBlockCheck(body: LessonBody): NewValidationFinding[] {
  const interactive = INTERACTIVE_LESSON_BLOCK_TYPES as readonly string[];
  if (body.blocks.some((b) => interactive.includes(b.blockType))) return [];
  return [
    {
      revisionType: 'lesson',
      revisionId: body.lessonId,
      kind: 'missing_interactive_block',
      severity: 'warning',
      label: 'Урок без інтерактиву',
      detail: `Урок складається лише з блоків для читання — додай хоча б один із: ${INTERACTIVE_LESSON_BLOCK_TYPES.join(', ')}.`,
    },
  ];
}

function orphanObjectiveCheck(
  body: LessonBody,
  knownObjectiveIds?: readonly string[],
): NewValidationFinding[] {
  if (!knownObjectiveIds) return [];
  if (knownObjectiveIds.includes(body.objectiveId)) return [];
  return [
    {
      revisionType: 'lesson',
      revisionId: body.lessonId,
      kind: 'orphan_objective',
      severity: 'blocking',
      label: 'Невідома ціль навчання',
      detail: `objectiveId «${body.objectiveId}» не знайдено серед відомих цілей.`,
    },
  ];
}

/** Run every structural check for one lesson body. */
export function runLessonQualityChecks(
  body: LessonBody,
  context: LessonQualityCheckContext = {},
): NewValidationFinding[] {
  const empty = emptyLessonCheck(body);
  if (empty.length > 0) {
    // No blocks — every other block-shape check would be vacuous/misleading.
    return [...empty, ...orphanObjectiveCheck(body, context.knownObjectiveIds)];
  }
  return [
    ...duplicateBlockIdCheck(body),
    ...unknownBlockTypeCheck(body),
    ...malformedPayloadCheck(body),
    ...missingRequiredBlocksCheck(body),
    ...missingInteractiveBlockCheck(body),
    ...orphanObjectiveCheck(body, context.knownObjectiveIds),
  ];
}
