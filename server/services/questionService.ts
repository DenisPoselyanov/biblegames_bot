import type { Difficulty, PracticeTrackProgress, Question } from '../../src/types/index';
import { QUESTIONS_PER_LEVEL } from '../../src/types/index';
import {
  buildCategoryDifficultyPool,
  buildThemeDifficultyPool,
  filterQuestionsByHierarchy,
  getQuestionsByIdsOrdered,
  getQuestionsForCategoryAsync,
  getQuestionsForCategoryStageAsync,
  getQuestionsForLevelAsync,
  getQuestionsForNodeAsync,
  getQuestionsForNodeStageAsync,
  getQuestionsForStageAsync,
  pickQuestionsForStage,
  pickQuestionsFromPool,
  type PracticePickOptions,
} from '../../src/data/questions';
import { findRootByThemeId } from '../../src/data/topicDbLoader.shared';
import type { CanonicalContentMode } from '../config/env';
import { metrics } from '../lib/metrics';
import { log } from '../lib/logger';
import { loadAllTopicHierarchies } from '../topicHierarchyLoader';
import { queryRows, useQuestionsSql } from '../db/pgPool';
import type { ContentQueryService } from './contentQuery';
import { applyMutationsToQuestions, rowToQuestion } from './questionRowMapper';

const DIFFICULTIES: Difficulty[] = [
  'baby',
  'child',
  'youth',
  'student',
  'preacher',
  'teacher',
  'theologian',
];

export type PickQuestionsParams = {
  themeId?: string;
  themeIds?: string[];
  difficulty: Difficulty;
  topicNodeId?: string;
  count?: number;
  excludeIds?: string[];
  seed?: string;
  stageIndex?: number;
  practiceTrack?: PracticeTrackProgress;
  nodeId?: string | null;
};

async function loadExclusionIds(): Promise<Set<string>> {
  if (!useQuestionsSql()) return new Set();
  const rows = await queryRows('select question_id from question_exclusions');
  return new Set(rows.map((r) => String(r.question_id)));
}

async function loadOverridesMap(): Promise<Map<string, Partial<Question>>> {
  if (!useQuestionsSql()) return new Map();
  const rows = await queryRows('select question_id, patch from question_overrides');
  const map = new Map<string, Partial<Question>>();
  for (const row of rows) {
    map.set(String(row.question_id), (row.patch as Partial<Question>) ?? {});
  }
  return map;
}

function applySqlMutations(
  questions: Question[],
  excluded: Set<string>,
  overrides: Map<string, Partial<Question>>,
): Question[] {
  return questions
    .filter((q) => !excluded.has(q.id))
    .map((q) => {
      const patch = overrides.get(q.id);
      if (!patch) return q;
      return { ...q, ...patch, id: q.id };
    });
}

// --- Canonical content repository seam (Phase 2 §14, WS3 part 3) --------------

interface CanonicalContent {
  mode: CanonicalContentMode;
  query: ContentQueryService;
}
let canonicalContent: CanonicalContent | null = null;

/** Wire the published-revision repository in (`server/app.ts`). */
export function configureCanonicalContent(next: CanonicalContent | null): void {
  canonicalContent = next && next.mode !== 'off' ? next : null;
}

/** Test isolation. */
export function resetCanonicalContent(): void {
  canonicalContent = null;
}

type QuestionFilters = {
  themeId?: string;
  themeIds?: string[];
  difficulty?: Difficulty;
  ids?: string[];
};

function canonicalFilterOf(filters: QuestionFilters) {
  const themeIds = filters.themeId
    ? [filters.themeId]
    : filters.themeIds && filters.themeIds.length
      ? filters.themeIds
      : undefined;
  return {
    themeIds,
    difficulty: filters.difficulty ?? null,
    questionIds: filters.ids && filters.ids.length ? filters.ids : undefined,
  };
}

async function fetchCanonicalQuestions(filters: QuestionFilters): Promise<Question[]> {
  if (!canonicalContent) return [];
  const filter = canonicalFilterOf(filters);
  const rows = filters.ids?.length
    ? await canonicalContent.query.getPublishedByIds(filters.ids)
    : await canonicalContent.query.listPublished(filter);
  return rows;
}

/**
 * Source dispatcher. `off` → legacy SQL only. `canonical` → published revisions,
 * legacy SQL only when the canonical result is empty. `compare` → serve legacy,
 * read canonical too and log every id-set divergence (§27.3 dual-read).
 */
async function fetchQuestions(filters: QuestionFilters): Promise<Question[]> {
  if (!canonicalContent) return fetchQuestionsFromSql(filters);

  if (canonicalContent.mode === 'canonical') {
    try {
      const rows = await fetchCanonicalQuestions(filters);
      if (rows.length > 0) return rows;
    } catch (err) {
      metrics.inc('content_source_error_total', { source: 'canonical' });
      log.error('canonical content read failed, falling back to legacy', {
        msg2: (err as Error).message,
      });
    }
    return fetchQuestionsFromSql(filters);
  }

  // compare
  const legacy = await fetchQuestionsFromSql(filters);
  try {
    const canonical = await fetchCanonicalQuestions(filters);
    reportDivergence(filters, legacy, canonical);
  } catch (err) {
    metrics.inc('content_source_error_total', { source: 'canonical' });
    log.error('canonical content compare read failed', { msg2: (err as Error).message });
  }
  return legacy;
}

function reportDivergence(
  filters: QuestionFilters,
  legacy: Question[],
  canonical: Question[],
): void {
  const legacyIds = new Set(legacy.map((q) => q.id));
  const canonicalIds = new Set(canonical.map((q) => q.id));
  const missingFromCanonical = [...legacyIds].filter((id) => !canonicalIds.has(id));
  const extraInCanonical = [...canonicalIds].filter((id) => !legacyIds.has(id));
  if (missingFromCanonical.length === 0 && extraInCanonical.length === 0) {
    metrics.inc('content_source_compare_total', { result: 'match' });
    return;
  }
  metrics.inc('content_source_compare_total', { result: 'divergent' });
  metrics.inc('content_source_divergence_total', {}, missingFromCanonical.length + extraInCanonical.length);
  log.warn('canonical content diverges from legacy', {
    themeId: filters.themeId,
    themeIds: filters.themeIds?.slice(0, 8),
    difficulty: filters.difficulty,
    legacyCount: legacy.length,
    canonicalCount: canonical.length,
    missingFromCanonical: missingFromCanonical.slice(0, 20),
    extraInCanonical: extraInCanonical.slice(0, 20),
  });
}

async function fetchQuestionsFromSql(filters: QuestionFilters): Promise<Question[]> {
  const excluded = await loadExclusionIds();
  const overrides = await loadOverridesMap();

  if (filters.ids?.length) {
    const rows = await queryRows(
      `select id, theme_id, difficulty, topic_node_id, source, payload
       from questions
       where id = any($1::text[])`,
      [filters.ids],
    );
    const byId = new Map(
      applySqlMutations(rows.map((r) => rowToQuestion(r as never)), excluded, overrides).map(
        (q) => [q.id, q],
      ),
    );
    return filters.ids.map((id) => byId.get(id)).filter((q): q is Question => q != null);
  }

  const params: unknown[] = [];
  const clauses: string[] = ['1=1'];

  if (filters.themeId) {
    params.push(filters.themeId);
    clauses.push(`theme_id = $${params.length}`);
  } else if (filters.themeIds?.length) {
    params.push(filters.themeIds);
    clauses.push(`theme_id = any($${params.length}::text[])`);
  }

  if (filters.difficulty) {
    params.push(filters.difficulty);
    clauses.push(`difficulty = $${params.length}`);
  }

  const rows = await queryRows(
    `select id, theme_id, difficulty, topic_node_id, source, payload
     from questions
     where ${clauses.join(' and ')}`,
    params,
  );

  return applySqlMutations(rows.map((r) => rowToQuestion(r as never)), excluded, overrides);
}

async function buildPoolForParams(params: PickQuestionsParams): Promise<Question[]> {
  const nodeId = params.topicNodeId ?? params.nodeId ?? null;

  if (nodeId && params.themeId) {
    const hierarchies = await loadAllTopicHierarchies();
    const root = findRootByThemeId(hierarchies, params.themeId);
    if (root) {
      if (useQuestionsSql() || canonicalContent) {
        const raw = await fetchQuestions({
          themeId: params.themeId,
          difficulty: params.difficulty,
        });
        const filtered = filterQuestionsByHierarchy(raw, nodeId, root, false, false);
        if (filtered.length > 0) return filtered;
      }
      const { buildNodePracticePool } = await import('../../src/data/questions');
      return buildNodePracticePool(nodeId, root, params.difficulty, false, false);
    }
  }

  if (params.themeIds?.length) {
    if (useQuestionsSql() || canonicalContent) {
      const pool = await fetchQuestions({
        themeIds: params.themeIds,
        difficulty: params.difficulty,
      });
      if (pool.length > 0) return pool;
    }
    return buildCategoryDifficultyPool(params.themeIds, params.difficulty);
  }

  if (params.themeId) {
    if (useQuestionsSql() || canonicalContent) {
      const pool = await fetchQuestions({
        themeId: params.themeId,
        difficulty: params.difficulty,
      });
      if (pool.length > 0) return pool;
    }
    return buildThemeDifficultyPool(params.themeId, params.difficulty);
  }

  return [];
}

export async function pickQuestions(params: PickQuestionsParams): Promise<Question[]> {
  const count = params.count ?? QUESTIONS_PER_LEVEL;
  const pickOptions: PracticePickOptions = {
    excludeIds: params.excludeIds,
    runNonce: params.seed,
    themeId: params.themeId,
    nodeId: params.nodeId ?? params.topicNodeId ?? null,
    difficulty: params.difficulty,
    stageIndex: params.stageIndex,
    practiceTrack: params.practiceTrack,
  };

  const stageIndex = params.stageIndex;
  const isStage = stageIndex != null && Number.isFinite(stageIndex);

  const pool = await buildPoolForParams(params);
  if (pool.length === 0) {
    return pickQuestionsJsonFallback(params, count, pickOptions);
  }

  if (isStage) {
    return pickQuestionsForStage(pool, stageIndex, count, pickOptions);
  }
  return pickQuestionsFromPool(pool, count, pickOptions);
}

async function pickQuestionsJsonFallback(
  params: PickQuestionsParams,
  count: number,
  pickOptions: PracticePickOptions,
): Promise<Question[]> {
  const stageIndex = params.stageIndex;
  const isStage = stageIndex != null && Number.isFinite(stageIndex);
  const nodeId = params.topicNodeId ?? params.nodeId ?? null;

  if (nodeId) {
    const hierarchies = await loadAllTopicHierarchies();
    const root = params.themeId ? findRootByThemeId(hierarchies, params.themeId) : null;
    if (root) {
      if (isStage) {
        return getQuestionsForNodeStageAsync(
          nodeId,
          root,
          params.difficulty,
          stageIndex!,
          count,
          false,
          false,
          pickOptions,
        );
      }
      return getQuestionsForNodeAsync(
        nodeId,
        root,
        params.difficulty,
        count,
        false,
        false,
        pickOptions,
      );
    }
  }

  if (params.themeIds?.length) {
    if (isStage) {
      return getQuestionsForCategoryStageAsync(
        params.themeIds,
        params.difficulty,
        stageIndex!,
        count,
        pickOptions,
      );
    }
    return getQuestionsForCategoryAsync(
      params.themeIds[0] ?? '',
      params.themeIds,
      params.difficulty,
      count,
      pickOptions,
    );
  }

  if (params.themeId) {
    if (isStage) {
      return getQuestionsForStageAsync(
        params.themeId,
        params.difficulty,
        stageIndex!,
        count,
        pickOptions,
      );
    }
    return getQuestionsForLevelAsync(params.themeId, params.difficulty, count, pickOptions);
  }

  return [];
}

export async function getQuestionsByIds(ids: string[]): Promise<Question[]> {
  if (ids.length === 0) return [];
  if (useQuestionsSql() || canonicalContent) {
    const rows = await fetchQuestions({ ids });
    if (rows.length > 0) return rows;
  }
  return getQuestionsByIdsOrdered(ids);
}

export async function getQuestionCounts(params: {
  themeId?: string;
  themeIds?: string[];
  topicNodeId?: string;
}): Promise<Record<Difficulty, number>> {
  const result = {} as Record<Difficulty, number>;
  for (const d of DIFFICULTIES) result[d] = 0;

  if (params.topicNodeId && params.themeId) {
    const hierarchies = await loadAllTopicHierarchies();
    const root = findRootByThemeId(hierarchies, params.themeId);
    if (root) {
      if (useQuestionsSql()) {
        for (const d of DIFFICULTIES) {
          const raw = await fetchQuestionsFromSql({ themeId: params.themeId, difficulty: d });
          result[d] = filterQuestionsByHierarchy(
            raw,
            params.topicNodeId!,
            root,
            false,
            false,
          ).length;
        }
        return result;
      }
      const { buildNodePracticePool } = await import('../../src/data/questions');
      for (const d of DIFFICULTIES) {
        result[d] = (await buildNodePracticePool(params.topicNodeId!, root, d, false, false))
          .length;
      }
      return result;
    }
  }

  if (useQuestionsSql()) {
    const excluded = await loadExclusionIds();
    const excludedList = [...excluded];

    if (params.themeId) {
      const rows = await queryRows(
        `select difficulty, count(*)::int as cnt
         from questions
         where theme_id = $1
           and (cardinality($2::text[]) = 0 or id <> all($2::text[]))
         group by difficulty`,
        [params.themeId, excludedList],
      );
      for (const row of rows) {
        const diff = row.difficulty as Difficulty;
        if (DIFFICULTIES.includes(diff)) result[diff] = Number(row.cnt);
      }
      return result;
    }

    if (params.themeIds?.length) {
      const rows = await queryRows(
        `select difficulty, count(*)::int as cnt
         from questions
         where theme_id = any($1::text[])
           and (cardinality($2::text[]) = 0 or id <> all($2::text[]))
         group by difficulty`,
        [params.themeIds, excludedList],
      );
      for (const row of rows) {
        const diff = row.difficulty as Difficulty;
        if (DIFFICULTIES.includes(diff)) result[diff] += Number(row.cnt);
      }
      return result;
    }
  }

  if (params.themeId) {
    for (const d of DIFFICULTIES) {
      result[d] = (await buildThemeDifficultyPool(params.themeId, d)).length;
    }
  } else if (params.themeIds?.length) {
    for (const d of DIFFICULTIES) {
      result[d] = (await buildCategoryDifficultyPool(params.themeIds, d)).length;
    }
  }

  return result;
}

export async function getQuestionsMeta(): Promise<
  Array<{ themeId: string; counts: Record<Difficulty, number>; total: number }>
> {
  if (useQuestionsSql()) {
    const excluded = await loadExclusionIds();
    const rows = await queryRows(
      `select theme_id, difficulty, count(*)::int as cnt
       from questions
       where (cardinality($1::text[]) = 0 or id <> all($1::text[]))
       group by theme_id, difficulty
       order by theme_id`,
      [[...excluded]],
    );
    const byTheme = new Map<string, Record<Difficulty, number>>();
    for (const row of rows) {
      const themeId = String(row.theme_id);
      const diff = row.difficulty as Difficulty;
      if (!byTheme.has(themeId)) {
        const empty = {} as Record<Difficulty, number>;
        for (const d of DIFFICULTIES) empty[d] = 0;
        byTheme.set(themeId, empty);
      }
      const counts = byTheme.get(themeId)!;
      if (DIFFICULTIES.includes(diff)) counts[diff] = Number(row.cnt);
    }
    return [...byTheme.entries()].map(([themeId, counts]) => ({
      themeId,
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    }));
  }

  const { ALL_QUESTIONS } = await import('../../src/data/questions');
  const byTheme = new Map<string, Record<Difficulty, number>>();
  for (const q of applyMutationsToQuestions(ALL_QUESTIONS)) {
    if (!byTheme.has(q.themeId)) {
      const empty = {} as Record<Difficulty, number>;
      for (const d of DIFFICULTIES) empty[d] = 0;
      byTheme.set(q.themeId, empty);
    }
    byTheme.get(q.themeId)![q.difficulty]++;
  }
  return [...byTheme.entries()].map(([themeId, counts]) => ({
    themeId,
    counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
  }));
}

export async function pickKahootQuestions(
  themeIds: string[],
  count: number,
  difficulty: Difficulty = 'youth',
): Promise<Question[]> {
  if (useQuestionsSql() || canonicalContent) {
    const pool = await fetchQuestions({ themeIds, difficulty });
    if (pool.length > 0) {
      return pickQuestionsFromPool(pool, count, { excludeIds: [] });
    }
  }
  const { getKahootQuestions } = await import('../../src/data/kahootQuestions');
  return getKahootQuestions(themeIds, count, difficulty);
}

export async function pickKahootQuestionsByIds(
  questionIds: string[],
  count?: number,
): Promise<Question[]> {
  const list = await getQuestionsByIds(questionIds);
  const limit = count ?? list.length;
  return list.slice(0, limit);
}
