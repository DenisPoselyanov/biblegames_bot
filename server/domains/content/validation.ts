/**
 * Question-body validation for content ingestion (Phase 2 §14).
 *
 * The rule §14 calls out: "invalid `correctIndex` is rejected/quarantined; the
 * first-option fallback disappears." This module never defaults a missing or
 * out-of-range answer key to 0 — a body that cannot be trusted is reported, and
 * the importer quarantines it.
 */
import type { Difficulty } from '../../../contracts/index';
import { DIFFICULTY_VALUES } from '../../../contracts/index';
import type { RevisionDraft, ScriptureRef } from './types';

export interface RawQuestionInput {
  id: string;
  themeId: string;
  difficulty: string;
  text: string;
  options: unknown;
  /** May be `correctIndex`, legacy `correct`, or absent — no fallback is applied. */
  correctIndex?: unknown;
  correct?: unknown;
  explanationShort?: unknown;
  explanationDeep?: unknown;
  reference?: unknown;
  topicNodeId?: unknown;
  topicPath?: unknown;
  tags?: unknown;
  scriptureRefs?: ScriptureRef[] | null;
  source?: unknown;
}

export type ValidationIssue =
  | 'empty_text'
  | 'too_few_options'
  | 'blank_option'
  | 'missing_correct_index'
  | 'correct_index_out_of_range'
  | 'unknown_difficulty'
  | 'missing_theme';

export type ValidationResult =
  | { ok: true; draft: RevisionDraft }
  | { ok: false; issues: ValidationIssue[] };

const DIFFICULTIES = new Set<string>(DIFFICULTY_VALUES);

/** Coerce an arbitrary legacy value to a trimmed non-empty string, or null. */
function optionalText(value: unknown): string | null {
  if (typeof value === 'string') {
    const t = value.trim();
    return t.length ? t : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function stringTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim());
}

export function validateQuestion(raw: RawQuestionInput): ValidationResult {
  const issues: ValidationIssue[] = [];

  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  if (!text) issues.push('empty_text');

  const options = Array.isArray(raw.options)
    ? raw.options.map((o) => (typeof o === 'string' ? o.trim() : ''))
    : [];
  if (options.length < 2) issues.push('too_few_options');
  if (options.some((o) => o.length === 0)) issues.push('blank_option');

  if (!raw.themeId) issues.push('missing_theme');
  if (!DIFFICULTIES.has(raw.difficulty)) issues.push('unknown_difficulty');

  const rawIndex = raw.correctIndex ?? raw.correct;
  const correctIndex =
    typeof rawIndex === 'number' && Number.isInteger(rawIndex) ? rawIndex : null;
  if (correctIndex === null) {
    issues.push('missing_correct_index');
  } else if (correctIndex < 0 || (options.length > 0 && correctIndex >= options.length)) {
    issues.push('correct_index_out_of_range');
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    draft: {
      questionId: raw.id,
      themeId: raw.themeId,
      difficulty: raw.difficulty as Difficulty,
      topicNodeId: optionalText(raw.topicNodeId),
      topicPath: optionalText(raw.topicPath),
      text,
      options,
      correctIndex: correctIndex as number,
      explanationShort: optionalText(raw.explanationShort),
      explanationDeep: optionalText(raw.explanationDeep),
      reference: optionalText(raw.reference),
      scriptureRefs: Array.isArray(raw.scriptureRefs) ? raw.scriptureRefs : [],
      tags: stringTags(raw.tags),
      source: optionalText(raw.source) ?? 'legacy',
      status: 'legacy_unreviewed',
    },
  };
}
