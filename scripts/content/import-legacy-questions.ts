/**
 * Import the legacy question corpus into the canonical revision repository
 * (Phase 2 §14, §18.3).
 *
 * Sources, deduped by question id (later source wins):
 *   1. embedded `ALL_QUESTIONS`
 *   2. `data/question-db/<theme>.json`
 *
 * Every body lands as a `question_revisions` row with status
 * `legacy_unreviewed` — never `published`. An invalid answer key is imported
 * then quarantined; a structurally broken body is rejected and listed.
 *
 * Usage:  DATABASE_URL=postgres://… npx tsx scripts/content/import-legacy-questions.ts [--dry]
 */
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_QUESTIONS } from '../../src/data/questions';
import type { Question } from '../../src/types';
import { importLegacyQuestions } from '../../server/domains/content/import';
import { createInMemoryContentRepositories } from '../../server/domains/content/inMemoryRepository';
import { createSqlContentRepositories } from '../../server/infrastructure/database/repositories/content';
import { createDatabase } from '../../server/infrastructure/database/client';
import { getPool, isDatabaseConfigured } from '../../server/db/pgPool';
import type { RawQuestionInput } from '../../server/domains/content/validation';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DB_DIR = join(ROOT, 'data/question-db');

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

function toRaw(q: Question): RawQuestionInput {
  return {
    id: q.id,
    themeId: q.themeId,
    difficulty: q.difficulty,
    text: q.text,
    options: q.options,
    correctIndex: q.correctIndex,
    explanationShort: q.explanationShort ?? null,
    explanationDeep: q.explanationDeep ?? null,
    reference: q.reference ?? null,
    topicNodeId: q.topicNodeId ?? null,
    topicPath: q.topicPath ?? null,
    tags: q.tags ?? null,
    source: q.sourceQuality === 'ai-draft' || q.createdAt ? 'ai' : 'embedded',
  };
}

function collectCorpus(): RawQuestionInput[] {
  const byId = new Map<string, Question>();
  for (const q of ALL_QUESTIONS) if (q?.id) byId.set(q.id, q);
  if (fs.existsSync(DB_DIR)) {
    for (const file of fs.readdirSync(DB_DIR)) {
      if (!file.endsWith('.json')) continue;
      const themeId = file.replace(/\.json$/, '');
      try {
        const list = JSON.parse(fs.readFileSync(join(DB_DIR, file), 'utf8')) as Question[];
        if (Array.isArray(list)) {
          for (const q of list) if (q?.id) byId.set(q.id, { ...q, themeId: q.themeId || themeId });
        }
      } catch {
        console.warn(`  skipped unreadable ${file}`);
      }
    }
  }
  return [...byId.values()].map(toRaw);
}

async function main(): Promise<void> {
  loadRootEnv();
  const dry = process.argv.includes('--dry');
  const corpus = collectCorpus();
  console.log(`Collected ${corpus.length} unique questions.`);

  const repos = dry
    ? createInMemoryContentRepositories()
    : (() => {
        if (!isDatabaseConfigured()) {
          console.error('DATABASE_URL is required (or pass --dry).');
          process.exit(1);
        }
        return null;
      })();

  const report = repos
    ? await importLegacyQuestions(repos, corpus)
    : await (async () => {
        const pool = await getPool();
        try {
          return await importLegacyQuestions(createSqlContentRepositories(createDatabase(pool)), corpus);
        } finally {
          await pool.end();
        }
      })();

  console.log(
    `\n${dry ? '[dry] ' : ''}created ${report.created}, unchanged ${report.unchanged}, ` +
      `quarantined ${report.quarantined}, rejected ${report.rejected.length}`,
  );
  for (const r of report.rejected.slice(0, 25)) {
    console.log(`  reject ${r.id}: ${r.issues.join(', ')}`);
  }
  if (report.rejected.length > 25) console.log(`  … ${report.rejected.length - 25} more`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
