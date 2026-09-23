/**
 * Derive the Phase 3 Learning domain (plans/modules/objectives/lessons) from the
 * existing topic tree (`data/topics-db/*.json`) — Phase 3 WS1, ADR-017.
 *
 * Depth-agnostic mapping (ADR-017 §"Rішення"): each theme file's root becomes one
 * `learning_plans` row (`id` = the file's theme id, reusing the vocabulary already
 * on `question_revisions.theme_id`). Every non-leaf descendant becomes a
 * `learning_modules` row, self-referencing `parentModuleId` when nested more than
 * one level deep (Pentateuch's book → period grouping; most themes are only book →
 * leaf). Every leaf becomes exactly one `learning_objectives` row *and* one
 * `lessons` row wrapping it 1:1, attached to its direct-parent module — this
 * works uniformly whether that parent sits at depth 1 or depth 2, because the
 * script never assumes a fixed depth.
 *
 * Every row lands `status = 'legacy_unreviewed'` (never `published`) — the same
 * rule content import uses (ADR-004). Nothing here promotes a plan to visible in
 * a read API; that gate is WS2's to build.
 *
 * Idempotent: every id is deterministic (the topic-tree node id, or `lesson_` +
 * that id), so re-running upserts the same rows rather than duplicating them.
 * `--dry` computes and reports without writing. Requires `DATABASE_URL` — the
 * published-question coverage count needs the DB (same shape as
 * `backfill-progression.ts`).
 *
 * Usage:
 *   DATABASE_URL=postgres://… npx tsx scripts/migrate/map-learning-content.ts [--dry] [--theme=<id>]
 */
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, isDatabaseConfigured } from '../../server/db/pgPool';
import { createDatabase } from '../../server/infrastructure/database/client';
import { createSqlLearningRepositories } from '../../server/infrastructure/database/repositories/learning';
import type {
  LessonBlockUpsert,
  ModuleUpsert,
  ObjectiveUpsert,
  LessonUpsert,
  PlanUpsert,
} from '../../server/domains/learning/types';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const TOPICS_DIR = join(ROOT, 'data/topics-db');

function loadRootEnv(): void {
  const envPath = join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let value = t.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

interface TopicNode {
  id: string;
  title: string;
  description?: string | null;
  icon?: string;
  children?: TopicNode[];
  themeId?: string;
}

interface WalkOutput {
  plan: PlanUpsert;
  modules: ModuleUpsert[];
  objectives: ObjectiveUpsert[];
  lessons: LessonUpsert[];
}

/** Walk one theme file's tree into plan/module/objective/lesson drafts. */
function mapTheme(root: TopicNode): WalkOutput {
  const modules: ModuleUpsert[] = [];
  const objectives: ObjectiveUpsert[] = [];
  const lessons: LessonUpsert[] = [];
  const planId = root.id;

  function walk(node: TopicNode, parentModuleId: string | null, breadcrumb: string[]): void {
    const isLeaf = !node.children || node.children.length === 0;
    if (isLeaf) {
      if (!parentModuleId) {
        throw new Error(
          `theme "${planId}": leaf topic "${node.id}" has no module ancestor — every theme file observed so far ` +
            `has at least one non-leaf level between root and leaf (ADR-017); this file breaks that assumption.`,
        );
      }
      objectives.push({
        id: node.id,
        planId,
        title: node.title,
        description: node.description ?? null,
        topicPath: [...breadcrumb, node.title].join(' › '),
        position: objectives.length,
      });
      lessons.push({
        id: `lesson_${node.id}`,
        planId,
        moduleId: parentModuleId,
        objectiveId: node.id,
        title: node.title,
        description: node.description ?? null,
        position: lessons.length,
      });
      return;
    }
    modules.push({
      id: node.id,
      planId,
      parentModuleId,
      title: node.title,
      description: node.description ?? null,
      position: modules.length,
    });
    const nextBreadcrumb = [...breadcrumb, node.title];
    for (const child of node.children ?? []) walk(child, node.id, nextBreadcrumb);
  }

  for (const child of root.children ?? []) walk(child, null, [root.title]);

  return {
    plan: { id: planId, themeId: planId, title: root.title, description: root.description ?? null },
    modules,
    objectives,
    lessons,
  };
}

/**
 * A lesson's default content — heading + explanation, always safe to regenerate.
 *
 * No `question` block: an earlier version emitted `{ topicNodeId, availableCount }`
 * here, a pointer shape that `questionPayload` rejects and nothing ever resolved —
 * every such block rendered as "тимчасово недоступний". Interactive blocks are
 * now authored per lesson in Content Studio instead. Re-running this script
 * removes the stale blocks (`replaceForLesson` rewrites a lesson's full set).
 */
function defaultBlocksFor(objective: ObjectiveUpsert): LessonBlockUpsert[] {
  const lessonId = `lesson_${objective.id}`;
  const blocks: LessonBlockUpsert[] = [
    { id: `${lessonId}_b0`, lessonId, position: 0, blockType: 'heading', payload: { text: objective.title } },
  ];
  if (objective.description) {
    blocks.push({
      id: `${lessonId}_b1`,
      lessonId,
      position: 1,
      blockType: 'explanation',
      payload: { text: objective.description },
    });
  }
  return blocks;
}

interface Report {
  dry: boolean;
  themesScanned: number;
  plansWritten: number;
  modulesWritten: number;
  objectivesWritten: number;
  lessonsWritten: number;
  objectivesWithPublishedContent: number;
  objectivesWithoutPublishedContent: number;
  sampleGaps: string[];
}

async function main(): Promise<void> {
  loadRootEnv();
  const dry = process.argv.includes('--dry');
  const themeArg = process.argv.find((a) => a.startsWith('--theme='))?.split('=')[1];

  if (!isDatabaseConfigured()) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const files = fs
    .readdirSync(TOPICS_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'topics-db.json')
    .filter((f) => !themeArg || f === `${themeArg}.json`);

  const pool = await getPool();
  const db = createDatabase(pool);
  const learning = createSqlLearningRepositories(db);

  // One query for every objective's published-question coverage, instead of one
  // query per objective (~460 leaves across the current 17 theme files).
  const { rows: coverageRows } = await pool.query<{ topic_node_id: string; n: string }>(
    `select topic_node_id, count(*)::text as n
     from question_revisions
     where status = 'published' and topic_node_id is not null
     group by topic_node_id`,
  );
  const coverage = new Map(coverageRows.map((r) => [r.topic_node_id, Number(r.n)]));

  const report: Report = {
    dry,
    themesScanned: 0,
    plansWritten: 0,
    modulesWritten: 0,
    objectivesWritten: 0,
    lessonsWritten: 0,
    objectivesWithPublishedContent: 0,
    objectivesWithoutPublishedContent: 0,
    sampleGaps: [],
  };

  for (const file of files) {
    const root = JSON.parse(fs.readFileSync(join(TOPICS_DIR, file), 'utf8')) as TopicNode;
    const mapped = mapTheme(root);
    report.themesScanned += 1;

    if (!dry) await learning.plans.upsert(mapped.plan);
    report.plansWritten += 1;

    for (const m of mapped.modules) {
      if (!dry) await learning.modules.upsert(m);
      report.modulesWritten += 1;
    }
    for (const o of mapped.objectives) {
      if (!dry) await learning.objectives.upsert(o);
      report.objectivesWritten += 1;

      const n = coverage.get(o.id) ?? 0;
      if (n > 0) report.objectivesWithPublishedContent += 1;
      else {
        report.objectivesWithoutPublishedContent += 1;
        if (report.sampleGaps.length < 30) report.sampleGaps.push(`${mapped.plan.id}/${o.id}: ${o.title}`);
      }
    }
    for (const l of mapped.lessons) {
      if (!dry) await learning.lessons.upsert(l);
      report.lessonsWritten += 1;

      if (!dry) {
        const objective = mapped.objectives.find((o) => o.id === l.objectiveId)!;
        await learning.blocks.replaceForLesson(l.id, defaultBlocksFor(objective));
      }
    }
  }

  console.log(JSON.stringify(report, null, 2));
  await pool.end();
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
