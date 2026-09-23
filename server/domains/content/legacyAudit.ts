/**
 * Legacy content-bank audit (Phase 4 WS10, spec §12.1–§12.3). Pure: takes the
 * raw legacy corpus + a little context, returns an inventory, a per-item
 * classification and a migration-wave assignment. No I/O — the CLI
 * (`scripts/ai/cli.ts audit-legacy`) loads files and writes the report.
 *
 * It reuses the canonical validators instead of re-deriving rules:
 * `validateQuestion` (WS2 schema) and `runQuestionQualityChecks` (WS3).
 *
 * Duplicate detection at bank scale (~90k items) cannot be WS3's pairwise
 * Jaccard pass (quadratic). Here: an exact key (normalized text + options) and
 * a near key (the sorted distinct word set of the text, per theme). Anything
 * subtler is still caught per draft by WS3 in Studio.
 *
 * Nothing here ever marks an item publishable: §12.2 "reviewed and publishable
 * after evidence" requires Scripture evidence + a human, so the audit reports
 * that bucket as 0 by construction (§12.2 "do not mark all imported data
 * published merely to preserve current behavior").
 */
import { runQuestionQualityChecks } from './qualityChecks';
import { validateQuestion, type RawQuestionInput } from './validation';

export const LEGACY_CLASSES = [
  'publishable_after_evidence',
  'awaiting_review',
  'needs_repair',
  'duplicate_superseded',
  'invalid_quarantined',
  'unsupported',
] as const;
export type LegacyClass = (typeof LEGACY_CLASSES)[number];

/** §12.3 order. Wave 6 is "archive" — never imported. */
export const MIGRATION_WAVES = [
  { wave: 1, key: 'core_practice', label: 'Ядро практики (вузли з practice-stage-config)' },
  { wave: 2, key: 'learning_plans', label: 'Контент навчальних планів (вузли topics-db)' },
  { wave: 3, key: 'kahoot', label: 'Kahoot / групові плейлисти' },
  { wave: 4, key: 'remaining_themes', label: 'Решта тем каталогу' },
  { wave: 5, key: 'rare', label: 'Рідкісні / експериментальні (малі пули)' },
  { wave: 6, key: 'archive', label: 'Архів: непідтримуване, невалідне, дублікати' },
] as const;
export type WaveNumber = (typeof MIGRATION_WAVES)[number]['wave'];

export interface LegacyItem {
  raw: RawQuestionInput;
  /** e.g. `embedded`, `question-db/acts.json`. */
  source: string;
}

export interface LegacyAuditContext {
  /** Theme ids players can reach (`src/data/themes.ts`). */
  catalogThemeIds: readonly string[];
  /** Topic-node ids with a configured practice pool (`data/practice-stage-config.json`). */
  practiceNodeIds: readonly string[];
  /** Topic-node ids that are learning-plan objectives (`data/topics-db/*`). */
  learningNodeIds: readonly string[];
  /** A theme with fewer valid items than this is "rare" (wave 5). Default 100. */
  rareThemeThreshold?: number;
}

export interface LegacyAuditItem {
  id: string;
  source: string;
  themeId: string;
  difficulty: string;
  topicNodeId: string | null;
  classification: LegacyClass;
  wave: WaveNumber;
  /** Schema issues (invalid) or WS3 finding kinds. */
  findings: string[];
  duplicateOf?: string;
}

type Counts = Record<string, number>;

export interface LegacyAuditReport {
  total: number;
  bySource: Counts;
  byTheme: Counts;
  byDifficulty: Counts;
  /** Question type — by option count (`2_options` ≈ true/false). */
  byType: Counts;
  byLanguage: Counts;
  reference: { present: number; missing: number };
  explanation: { present: number; missing: number };
  byClassification: Record<LegacyClass, number>;
  byFinding: Counts;
  duplicates: { groups: number; items: number };
  /** Histogram of `correctIndex` over valid items (index = position). */
  firstAnswerDistribution: number[];
  byWave: Record<string, { total: number; importable: number; byClassification: Counts }>;
  items: LegacyAuditItem[];
}

/** Finding kinds that mean "fix the body before a reviewer can approve it". */
const REPAIR_KINDS = new Set([
  'answer_leakage',
  'duplicate_options',
  'missing_explanation',
  'weak_explanation',
  'mixed_language',
  'missing_reference',
  'reference_unparsed',
  'theme_canon_mismatch',
]);
// `reference_ambiguous` ("1 Цар.") is notation, not content — the AI reviewer resolves it from both candidate verses.

/** Classes that a migration wave imports as `legacy_unreviewed` drafts. Archive-only classes stay out. */
export const IMPORTABLE_CLASSES: ReadonlySet<LegacyClass> = new Set(['awaiting_review', 'needs_repair']);

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/['"«»`.,;:!?()\-–—ʼ’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const bump = (counts: Counts, key: string, by = 1) => {
  counts[key] = (counts[key] ?? 0) + by;
};

export function auditLegacyBank(items: readonly LegacyItem[], context: LegacyAuditContext): LegacyAuditReport {
  const catalog = new Set(context.catalogThemeIds);
  const practice = new Set(context.practiceNodeIds);
  const learning = new Set(context.learningNodeIds);
  const rareThreshold = context.rareThemeThreshold ?? 100;

  const report: LegacyAuditReport = {
    total: items.length,
    bySource: {},
    byTheme: {},
    byDifficulty: {},
    byType: {},
    byLanguage: {},
    reference: { present: 0, missing: 0 },
    explanation: { present: 0, missing: 0 },
    byClassification: Object.fromEntries(LEGACY_CLASSES.map((c) => [c, 0])) as Record<LegacyClass, number>,
    byFinding: {},
    duplicates: { groups: 0, items: 0 },
    firstAnswerDistribution: [],
    byWave: {},
    items: [],
  };

  const exactSeen = new Map<string, string>();
  const nearSeen = new Map<string, string>();
  const duplicateGroups = new Set<string>();
  const validPerTheme = new Map<string, number>();
  const answerPositions: Counts = {};

  // Pass 1 — classify.
  for (const { raw, source } of items) {
    const themeId = typeof raw.themeId === 'string' ? raw.themeId : '';
    const options = Array.isArray(raw.options) ? raw.options.map((o) => (typeof o === 'string' ? o : '')) : [];
    bump(report.bySource, source);
    bump(report.byTheme, themeId || '(none)');
    bump(report.byDifficulty, String(raw.difficulty || '(none)'));
    bump(report.byType, `${options.length}_options`);
    if (typeof raw.reference === 'string' && raw.reference.trim()) report.reference.present += 1;
    else report.reference.missing += 1;
    if (typeof raw.explanationShort === 'string' && raw.explanationShort.trim()) report.explanation.present += 1;
    else report.explanation.missing += 1;

    const base = {
      id: raw.id,
      source,
      themeId,
      difficulty: String(raw.difficulty ?? ''),
      topicNodeId: typeof raw.topicNodeId === 'string' ? raw.topicNodeId : null,
    };

    const validation = validateQuestion(raw);
    if (!validation.ok) {
      bump(report.byLanguage, 'unknown');
      for (const issue of validation.issues) bump(report.byFinding, `schema:${issue}`);
      report.items.push({ ...base, classification: 'invalid_quarantined', wave: 6, findings: validation.issues });
      continue;
    }

    const draft = validation.draft;
    bump(answerPositions, String(draft.correctIndex));

    const exactKey = `${normalize(draft.text)}|${draft.options.map(normalize).join('|')}`;
    const nearKey = `${themeId}|${[...new Set(normalize(draft.text).split(' '))].sort().join(' ')}`;
    const duplicateOf = exactSeen.get(exactKey) ?? nearSeen.get(nearKey);
    if (!exactSeen.has(exactKey)) exactSeen.set(exactKey, draft.questionId);
    if (!nearSeen.has(nearKey)) nearSeen.set(nearKey, draft.questionId);

    const findings = runQuestionQualityChecks(
      {
        questionId: draft.questionId,
        themeId: draft.themeId,
        text: draft.text,
        options: draft.options,
        correctIndex: draft.correctIndex,
        explanationShort: draft.explanationShort,
        explanationDeep: draft.explanationDeep,
        reference: draft.reference,
      },
      // Duplicates are handled by the keys above; the orphan check by the catalog below.
      { siblings: [] },
    );
    const kinds = findings.map((f) => f.kind);
    bump(report.byLanguage, kinds.includes('mixed_language') ? 'mixed' : 'uk');
    for (const k of kinds) bump(report.byFinding, k);

    let classification: LegacyClass;
    if (duplicateOf) {
      classification = 'duplicate_superseded';
      duplicateGroups.add(duplicateOf);
    } else if (!catalog.has(themeId)) {
      classification = 'unsupported';
    } else if (kinds.some((k) => REPAIR_KINDS.has(k))) {
      classification = 'needs_repair';
    } else {
      classification = 'awaiting_review';
    }
    if (IMPORTABLE_CLASSES.has(classification)) validPerTheme.set(themeId, (validPerTheme.get(themeId) ?? 0) + 1);

    report.items.push({
      ...base,
      classification,
      wave: 6,
      findings: kinds,
      ...(duplicateOf ? { duplicateOf } : {}),
    });
  }

  // Pass 2 — waves need per-theme pool sizes, so they are assigned after classification.
  // `report.items[i]` was pushed for `items[i]` — exactly one per input, in order.
  report.items.forEach((item, index) => {
    report.byClassification[item.classification] += 1;
    if (IMPORTABLE_CLASSES.has(item.classification)) {
      const source = String(items[index].raw.source ?? '');
      item.wave =
        item.topicNodeId && practice.has(item.topicNodeId)
          ? 1
          : item.topicNodeId && learning.has(item.topicNodeId)
            ? 2
            : /kahoot/i.test(source) || item.source.includes('kahoot')
              ? 3
              : (validPerTheme.get(item.themeId) ?? 0) < rareThreshold
                ? 5
                : 4;
    }
    const wave = (report.byWave[String(item.wave)] ??= { total: 0, importable: 0, byClassification: {} });
    wave.total += 1;
    if (IMPORTABLE_CLASSES.has(item.classification)) wave.importable += 1;
    bump(wave.byClassification, item.classification);
  });

  report.duplicates = { groups: duplicateGroups.size, items: report.byClassification.duplicate_superseded };
  const maxIndex = Math.max(-1, ...Object.keys(answerPositions).map(Number));
  report.firstAnswerDistribution = Array.from({ length: maxIndex + 1 }, (_, i) => answerPositions[String(i)] ?? 0);
  return report;
}
