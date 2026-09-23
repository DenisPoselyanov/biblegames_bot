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
import { warnDeprecated } from '../lib/deprecation.mjs';
warnDeprecated(import.meta.url);
import { importLegacyQuestions } from '../../server/domains/content/import';
import { createInMemoryContentRepositories } from '../../server/domains/content/inMemoryRepository';
import { createSqlContentRepositories } from '../../server/infrastructure/database/repositories/content';
import { createDatabase } from '../../server/infrastructure/database/client';
import { getPool, isDatabaseConfigured } from '../../server/db/pgPool';
import type { RawQuestionInput } from '../../server/domains/content/validation';
import { loadLegacyCorpus, loadRootEnv } from './legacyCorpus';

function collectCorpus(): RawQuestionInput[] {
  return loadLegacyCorpus().items.map((i) => i.raw);
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
