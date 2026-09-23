/**
 * Delete the broken `question` lesson blocks written by the Phase 3 WS1
 * topic-tree mapping (`map-learning-content.ts`, before it stopped emitting
 * them). Those blocks carry a `{ topicNodeId, availableCount }` pointer
 * instead of a real question — `questionPayload` rejects it, so every one of
 * them renders as "Цей елемент уроку тимчасово недоступний".
 *
 * Targeted on purpose: re-running `map-learning-content.ts` would also remove
 * them, but it rewrites every lesson's full block set and would clobber
 * lessons since authored in Content Studio. This touches only rows matching
 * the legacy pointer shape. Each such block was its lesson's last block, so
 * the `(lesson_id, position)` ordering stays gap-free. A lesson session whose
 * `checkpoint_block_id` pointed at a deleted block simply resumes at block 0.
 *
 * Usage:  DATABASE_URL=postgres://… npx tsx scripts/migrate/drop-legacy-question-blocks.ts [--dry]
 */
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, isDatabaseConfigured } from '../../server/db/pgPool';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

const LEGACY_QUESTION_FILTER = `block_type = 'question' and payload ? 'topicNodeId' and not payload ? 'prompt'`;

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

async function main(): Promise<void> {
  loadRootEnv();
  const dry = process.argv.includes('--dry');

  if (!isDatabaseConfigured()) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const pool = await getPool();
  const { rows } = await pool.query<{ n: string; sample: string[] | null }>(
    `select count(*)::text as n, (array_agg(lesson_id order by lesson_id))[1:10] as sample
     from lesson_blocks where ${LEGACY_QUESTION_FILTER}`,
  );
  const found = Number(rows[0]?.n ?? 0);

  let deleted = 0;
  if (!dry && found > 0) {
    const result = await pool.query(`delete from lesson_blocks where ${LEGACY_QUESTION_FILTER}`);
    deleted = result.rowCount ?? 0;
  }

  console.log(JSON.stringify({ dry, found, deleted, sampleLessons: rows[0]?.sample ?? [] }, null, 2));
  await pool.end();
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
