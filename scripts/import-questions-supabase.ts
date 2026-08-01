/**
 * Import embedded + data/question-db/*.json into Supabase questions table.
 */
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ALL_QUESTIONS } from '../src/data/questions';
import type { Question } from '../src/types';
import { loadExclusionsFromDisk, loadOverridesFromDisk } from '../server/questionMutations';
import { questionToRow } from '../server/services/questionRowMapper';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DB_DIR = join(ROOT, 'data/question-db');

function loadRootEnv(): void {
  const envPath = join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

function loadThemeQuestions(themeId: string): Question[] {
  const path = join(DB_DIR, `${themeId}.json`);
  if (!fs.existsSync(path)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(path, 'utf8')) as Question[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  loadRootEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.includes('[password]')) {
    console.error('Set DATABASE_URL in .env before import.');
    process.exit(1);
  }

  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  const exclusions = new Set(loadExclusionsFromDisk());
  const overrides = loadOverridesFromDisk();

  const byId = new Map<string, Question>();
  for (const q of ALL_QUESTIONS) {
    if (q?.id) byId.set(q.id, q);
  }

  if (fs.existsSync(DB_DIR)) {
    for (const file of fs.readdirSync(DB_DIR)) {
      if (!file.endsWith('.json')) continue;
      const themeId = file.replace(/\.json$/, '');
      for (const q of loadThemeQuestions(themeId)) {
        if (q?.id) byId.set(q.id, { ...q, themeId: q.themeId || themeId });
      }
    }
  }

  const all = [...byId.values()].filter((q) => !exclusions.has(q.id));
  console.log(`Upserting ${all.length} questions...`);

  const schemaPath = join(ROOT, 'server/db/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schemaSql);

  const client = await pool.connect();
  try {
    await client.query('begin');

    await client.query('truncate table question_exclusions');
    for (const id of exclusions) {
      await client.query(
        'insert into question_exclusions(question_id) values ($1) on conflict do nothing',
        [id],
      );
    }

    await client.query('truncate table question_overrides');
    for (const [questionId, patch] of Object.entries(overrides)) {
      await client.query(
        `insert into question_overrides(question_id, patch, updated_at)
         values ($1, $2::jsonb, now())`,
        [questionId, JSON.stringify(patch)],
      );
    }

    for (let i = 0; i < all.length; i++) {
      const q = all[i]!;
      const patch = overrides[q.id];
      const merged = patch ? ({ ...q, ...patch, id: q.id } as Question) : q;
      const source =
        merged.sourceQuality === 'ai-draft' || merged.createdAt ? 'ai' : 'embedded';
      const row = questionToRow(merged, source);
      await client.query(
        `insert into questions(id, theme_id, difficulty, topic_node_id, source, payload, updated_at)
         values ($1, $2, $3, $4, $5, $6::jsonb, now())
         on conflict (id) do update set
           theme_id = excluded.theme_id,
           difficulty = excluded.difficulty,
           topic_node_id = excluded.topic_node_id,
           source = excluded.source,
           payload = excluded.payload,
           updated_at = now()`,
        [
          row.id,
          row.theme_id,
          row.difficulty,
          row.topic_node_id,
          row.source,
          JSON.stringify(row.payload),
        ],
      );
      if ((i + 1) % 200 === 0 || i === all.length - 1) {
        console.log(`  ${i + 1} / ${all.length}`);
      }
    }

    await client.query('commit');
    console.log('Import complete.');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
