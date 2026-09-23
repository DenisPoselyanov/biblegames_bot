/**
 * Seed the showcase learning plan (`data/lessons/showcase-jonah.json`) — two
 * lessons on Jonah that together use every lesson block type.
 *
 * Follows the Phase 4 lifecycle: the lessons land as DRAFT lesson revisions,
 * so they appear in Content Studio's review queue and reach players only after
 * a reviewer approves and a publisher publishes them there. The plan / modules
 * / objectives (titles only) are created as `draft` too; once the lessons are
 * published, re-run with `--publish-structure` to make the plan visible in
 * the Learn hub.
 *
 * Usage:
 *   npm run content:seed-showcase                      # dry run: validate + print
 *   npm run content:seed-showcase -- --apply           # write drafts (needs DATABASE_URL)
 *   npm run content:seed-showcase -- --apply --publish-structure
 */
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LESSON_BLOCK_PAYLOAD_SCHEMAS } from '../../contracts/schemas/lessonBlocks';
import type { LearningRepositories } from '../../server/domains/learning/repository';
import type { LessonBlockType } from '../../server/domains/learning/types';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

/** Same minimal `.env` reader the other content scripts use — only fills unset keys. */
function loadRootEnv(): void {
  const envPath = join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    const eq = t.indexOf('=');
    if (!t || t.startsWith('#') || eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    const value = t.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[key] == null) process.env[key] = value;
  }
}

interface Showcase {
  plan: { id: string; themeId: string; title: string; description: string; testament: 'old_testament' | 'new_testament' };
  modules: Array<{ id: string; title: string; description: string }>;
  objectives: Array<{ id: string; title: string; topicPath: string }>;
  lessons: Array<{
    id: string;
    moduleId: string;
    objectiveId: string;
    title: string;
    description: string;
    blocks: Array<{ blockType: LessonBlockType; payload: Record<string, unknown> }>;
  }>;
}

export function loadShowcase(): Showcase {
  return JSON.parse(fs.readFileSync(join(ROOT, 'data/lessons/showcase-jonah.json'), 'utf8')) as Showcase;
}

export interface SeedResult {
  lessonRevisionIds: string[];
  created: number;
  unchanged: number;
}

/** Idempotent: upserts structure, appends a revision only when a lesson's body changed. */
export async function seedShowcase(
  repos: LearningRepositories,
  options: { publishStructure?: boolean } = {},
): Promise<SeedResult> {
  const s = loadShowcase();
  const status = options.publishStructure ? 'published' : 'draft';
  await repos.plans.upsert({ ...s.plan, status, source: 'authored' });
  for (const [position, m] of s.modules.entries()) {
    await repos.modules.upsert({ ...m, planId: s.plan.id, position, status, source: 'authored' });
  }
  for (const [position, o] of s.objectives.entries()) {
    await repos.objectives.upsert({ ...o, planId: s.plan.id, position, status, source: 'authored', testament: s.plan.testament });
  }
  const result: SeedResult = { lessonRevisionIds: [], created: 0, unchanged: 0 };
  for (const lesson of s.lessons) {
    const outcome = await repos.lessonRevisions.appendRevision({
      lessonId: lesson.id,
      planId: s.plan.id,
      moduleId: lesson.moduleId,
      objectiveId: lesson.objectiveId,
      title: lesson.title,
      description: lesson.description,
      blocks: lesson.blocks.map((b, i) => ({ id: `${lesson.id}-b${i + 1}`, blockType: b.blockType, schemaVersion: 1, payload: b.payload })),
      source: 'authored',
      createdBy: 'seed:showcase-jonah',
      status: 'draft',
    });
    result.lessonRevisionIds.push(outcome.revision.id);
    if (outcome.kind === 'created') result.created += 1;
    else result.unchanged += 1;
  }
  return result;
}

async function main(): Promise<void> {
  loadRootEnv();
  const apply = process.argv.includes('--apply');
  const publishStructure = process.argv.includes('--publish-structure');
  const s = loadShowcase();

  const problems: string[] = [];
  for (const lesson of s.lessons) {
    for (const [i, b] of lesson.blocks.entries()) {
      const schema = LESSON_BLOCK_PAYLOAD_SCHEMAS[b.blockType];
      if (!schema) problems.push(`${lesson.id} #${i + 1}: unknown block type ${b.blockType}`);
      else if (!schema.safeParse(b.payload).success) problems.push(`${lesson.id} #${i + 1}: invalid ${b.blockType} payload`);
    }
  }
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  const types = new Set(s.lessons.flatMap((l) => l.blocks.map((b) => b.blockType)));
  console.log(`«${s.plan.title}»: ${s.lessons.length} lessons, ${types.size} block types — ${[...types].join(', ')}`);

  if (!apply) {
    console.log('[dry] valid. Pass --apply (with DATABASE_URL) to write the plan + draft lesson revisions.');
    return;
  }
  const { getPool, isDatabaseConfigured } = await import('../../server/db/pgPool');
  if (!isDatabaseConfigured()) {
    console.error('DATABASE_URL is required for --apply.');
    process.exit(1);
  }
  const { createDatabase } = await import('../../server/infrastructure/database/client');
  const { createSqlLearningRepositories } = await import('../../server/infrastructure/database/repositories/learning');
  const pool = await getPool();
  try {
    const r = await seedShowcase(createSqlLearningRepositories(createDatabase(pool)), { publishStructure });
    console.log(
      `Draft lesson revisions: ${r.created} created, ${r.unchanged} unchanged (${r.lessonRevisionIds.join(', ')}).\n` +
        `Structure is ${publishStructure ? 'published' : 'draft'}. Review + publish the lessons in Content Studio → Черга.`,
    );
  } finally {
    await pool.end();
  }
}

// Run only when executed directly, not when imported by a dev harness.
if (process.argv[1] && /seed-showcase-lessons\.ts$/.test(process.argv[1].replace(/\\/g, '/'))) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
