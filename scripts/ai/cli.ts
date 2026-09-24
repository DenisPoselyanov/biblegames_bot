/**
 * `npm run ai -- <task> [options]` — the single content/AI entry point
 * (Phase 4 WS10, spec §9). Replaces the ~20 legacy scripts mapped in
 * `./deprecation-matrix.json`.
 *
 * Rules every task follows (§9):
 * - dry-run by default; anything that writes needs an explicit `--apply`;
 * - writes land as artifacts or `legacy_unreviewed` / draft revisions — never
 *   as published content, never by editing the bank's files in place;
 * - `--json` prints a machine-readable result instead of the human summary.
 *
 * AI tasks run through the very same job runner Content Studio uses
 * (`registerCoreJobs` → `content.ai_generate` / `content.ai_repair`), so a CLI
 * generation and a Studio generation are the same code path and budget.
 */
import fs from 'node:fs';
import { join } from 'node:path';
import { THEMES } from '../../src/data/themes';
import { buildQuestionGenerationPrompt, GENERATION_PROMPT_VERSION } from '../../src/lib/contentGenerationPrompt';
import { rubricFor } from '../../src/lib/contentLevelRubric';
import type { Difficulty } from '../../src/types';
import { loadConfig } from '../../server/config/env';
import { createMemoryAuditLog } from '../../server/audit';
import {
  auditLegacyBank,
  IMPORTABLE_CLASSES,
  MIGRATION_WAVES,
  type LegacyAuditReport,
  type LegacyItem,
} from '../../server/domains/content/legacyAudit';
import { validateQuestion } from '../../server/domains/content/validation';
import { importWave, rollbackWave } from '../../server/domains/content/legacyWaves';
import type { ContentRepositories } from '../../server/domains/content/repository';
import {
  QUESTION_CHECKS_VERSION,
  questionRevisionFindings,
  type RevisionValidationDeps,
} from '../../server/domains/content/revisionValidation';
import type { QuestionRevisionRecord, RevisionDraft } from '../../server/domains/content/types';
import { LESSON_CHECKS_VERSION, lessonRevisionFindings } from '../../server/domains/learning/revisionValidation';
import { JOB_TYPES } from '../../server/domains/jobs/catalog';
import { createInMemoryJobQueue } from '../../server/domains/jobs/inMemoryQueue';
import { buildRepairPrompt, REPAIR_PROMPT_VERSION } from '../../server/domains/quality/repairPrompt';
import { createAiProvider } from '../../server/infrastructure/ai';
import { createObjectStore } from '../../server/infrastructure/storage';
import { registerCoreJobs } from '../../server/jobs';
import { subjectFromDraft } from '../../server/domains/quality/assessmentSubject';
import { gateWave, type WaveGateResult } from '../../server/domains/quality/waveGate';
import { createQualityTasks, withQualityDb } from './qualityTasks';
import { ROOT, loadLearningNodeIds, loadLegacyCorpus, loadPracticeNodeIds, loadRootEnv } from '../content/legacyCorpus';

// --- args ------------------------------------------------------------------

const argv = process.argv.slice(2);
const task = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'help';
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};
const APPLY = flag('apply');
const JSON_OUT = flag('json');
const REPORT_DIR = join(ROOT, 'reports/content');

function out(human: string, machine: unknown): void {
  if (JSON_OUT) process.stdout.write(`${JSON.stringify(machine, null, 2)}\n`);
  else console.log(human);
}

function writeReport(name: string, data: unknown): string {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const path = join(REPORT_DIR, name);
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
  return path;
}

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

// --- shared ----------------------------------------------------------------

function runAudit(): { corpus: ReturnType<typeof loadLegacyCorpus>; report: LegacyAuditReport } {
  const corpus = loadLegacyCorpus();
  const report = auditLegacyBank(corpus.items, {
    catalogThemeIds: THEMES.map((t) => t.id),
    practiceNodeIds: loadPracticeNodeIds(),
    learningNodeIds: loadLearningNodeIds(),
  });
  return { corpus, report };
}

const pct = (n: number, total: number) => (total ? `${((n / total) * 100).toFixed(1)}%` : '—');

async function withContentDb<T>(
  fn: (repos: ContentRepositories, checks: RevisionValidationDeps) => Promise<T>,
): Promise<T> {
  const { getPool, isDatabaseConfigured } = await import('../../server/db/pgPool');
  if (!isDatabaseConfigured()) fail('DATABASE_URL is required for this task.');
  const { createDatabase } = await import('../../server/infrastructure/database/client');
  const { createSqlContentRepositories } = await import('../../server/infrastructure/database/repositories/content');
  const { createSqlValidationFindingRepository } = await import('../../server/infrastructure/database/repositories/validationFindings');
  const pool = await getPool();
  try {
    const database = createDatabase(pool);
    const checks: RevisionValidationDeps = {
      findings: createSqlValidationFindingRepository(database),
      context: { siblings: [], knownThemeIds: THEMES.map((t) => t.id) },
    };
    return await fn(createSqlContentRepositories(database), checks);
  } finally {
    await pool.end();
  }
}

/** Runs one AI job through the Studio's own runner and returns the artifact key. */
async function runAiJob(type: string, payload: Record<string, unknown>): Promise<{ jobId: string; artifactKey: string | null; status: string; error: string | null }> {
  const { config } = loadConfig();
  const provider = createAiProvider(config);
  if (!provider) fail(`No AI provider configured (CONTENT_AI_PROVIDER=${config.aiProvider}). See docs/AI_SETUP.md.`);
  const queue = createInMemoryJobQueue({ onEvent: () => {} });
  registerCoreJobs(queue, {
    query: async () => ({ rowCount: 0 }),
    ai: { provider, store: createObjectStore(config), budget: config.aiJobBudget, auditLog: createMemoryAuditLog() },
  });
  const { id } = await queue.enqueue(type, payload);
  for (let i = 0; i < 10; i += 1) {
    await queue.runDue();
    const job = await queue.get(id);
    if (job && ['completed', 'failed', 'cancelled'].includes(job.status)) {
      const artifactKey = typeof job.checkpoint?.artifactKey === 'string' ? job.checkpoint.artifactKey : null;
      return { jobId: id, artifactKey, status: job.status, error: job.error };
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  const job = await queue.get(id);
  return { jobId: id, artifactKey: null, status: job?.status ?? 'unknown', error: job?.error ?? 'did not finish' };
}

// --- tasks -----------------------------------------------------------------

const TASKS: Record<string, { summary: string; run: () => Promise<void> }> = {
  help: {
    summary: 'this list',
    async run() {
      const lines = ['Usage: npm run ai -- <task> [--apply] [--json]', ''];
      for (const [name, t] of Object.entries(TASKS)) lines.push(`  ${name.padEnd(20)} ${t.summary}`);
      lines.push('', 'Dry-run by default. Nothing is ever published by this CLI — publishing happens in Content Studio.');
      console.log(lines.join('\n'));
    },
  },

  scripts: {
    summary: 'deprecation matrix: every legacy script → its replacement',
    async run() {
      const matrix = JSON.parse(fs.readFileSync(join(ROOT, 'scripts/ai/deprecation-matrix.json'), 'utf8')) as {
        defaults: Record<string, string>;
        scripts: Array<{ file: string; npm: string | null; status: string; replacement: string | null }>;
      };
      const rows = matrix.scripts.map(
        (s) => `  ${s.status.padEnd(19)} ${(s.npm ?? s.file).padEnd(28)} → ${s.replacement ?? '—'}`,
      );
      out(
        [`Owner: ${matrix.defaults.owner}; compatible until ${matrix.defaults.compatibilityUntil}; removal: ${matrix.defaults.removalTarget}`, '', ...rows].join('\n'),
        matrix,
      );
    },
  },

  'audit-legacy': {
    summary: 'read-only inventory + classification + migration waves of the legacy bank (§12.1–§12.3)',
    async run() {
      const { corpus, report } = runAudit();
      const summary = { ...report, items: undefined, sourceBytes: corpus.sourceBytes, generatedAt: new Date().toISOString() };
      const path = writeReport('legacy-audit.json', { ...summary, items: report.items });
      const t = report.total;
      const human = [
        `Legacy bank: ${t.toLocaleString('uk-UA')} unique questions (${Object.keys(report.bySource).length} sources). Full report: ${path}`,
        '',
        'Classification (§12.2):',
        ...Object.entries(report.byClassification).map(([k, v]) => `  ${k.padEnd(28)} ${String(v).padStart(7)}  ${pct(v, t)}`),
        '',
        'Migration waves (§12.3):',
        ...MIGRATION_WAVES.map((w) => {
          const b = report.byWave[String(w.wave)];
          return `  ${w.wave}. ${w.label.padEnd(46)} total ${String(b?.total ?? 0).padStart(6)}  importable ${String(b?.importable ?? 0).padStart(6)}`;
        }),
        '',
        `Reference present ${pct(report.reference.present, t)} · explanation present ${pct(report.explanation.present, t)} · duplicates ${report.duplicates.items} in ${report.duplicates.groups} groups`,
        `Correct-answer position: ${report.firstAnswerDistribution.map((n, i) => `${String.fromCharCode(65 + i)} ${pct(n, t)}`).join(' · ')}`,
      ].join('\n');
      out(human, summary);
    },
  },

  'validate-content': {
    summary: 'read-only: canonical WS2/WS3 checks per question (--theme X, --class needs_repair, --limit N)',
    async run() {
      const { report } = runAudit();
      const theme = opt('theme');
      const cls = opt('class');
      const limit = Number(opt('limit') ?? 50);
      const rows = report.items.filter(
        (i) => (!theme || i.themeId === theme) && (cls ? i.classification === cls : i.classification !== 'awaiting_review'),
      );
      out(
        [
          `${rows.length} matching item(s)${rows.length > limit ? `, showing ${limit}` : ''}:`,
          ...rows.slice(0, limit).map((i) => `  ${i.id.padEnd(28)} ${i.classification.padEnd(22)} ${i.findings.join(', ')}${i.duplicateOf ? ` (dup of ${i.duplicateOf})` : ''}`),
        ].join('\n'),
        { total: rows.length, items: rows.slice(0, limit) },
      );
    },
  },

  'validate-revisions': {
    summary: `re-run the quality checks (${QUESTION_CHECKS_VERSION} / ${LESSON_CHECKS_VERSION} with --lessons) over every stored revision; --apply records the findings the publish gate reads`,
    async run() {
      const lessons = flag('lessons');
      const version = lessons ? LESSON_CHECKS_VERSION : QUESTION_CHECKS_VERSION;
      const result = await withContentDb(async (repos, checks) => {
        if (lessons) {
          const { createDatabase } = await import('../../server/infrastructure/database/client');
          const { createSqlLearningRepositories } = await import('../../server/infrastructure/database/repositories/learning');
          const { getPool } = await import('../../server/db/pgPool');
          // Same singleton pool withContentDb opened (and closes).
          const learning = createSqlLearningRepositories(createDatabase(await getPool()));
          const byKind: Record<string, number> = {};
          let total = 0;
          let blocked = 0;
          let afterId: string | null = null;
          for (;;) {
            const page = await learning.lessonRevisions.listPage({ afterId, limit: 500 });
            if (page.length === 0) break;
            for (const revision of page) {
              const findings = lessonRevisionFindings(revision);
              total += 1;
              if (findings.some((f) => f.severity === 'blocking')) blocked += 1;
              for (const f of findings) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
              if (APPLY) await checks.findings.record('lesson', revision.id, findings);
            }
            afterId = page[page.length - 1].id;
          }
          return { total, blocked, byKind };
        }
        const byKind: Record<string, number> = {};
        let total = 0;
        let blocked = 0;
        let afterId: string | null = null;
        for (;;) {
          const page = await repos.revisions.listPage({ afterId, limit: 500 });
          if (page.length === 0) break;
          for (const revision of page) {
            const findings = questionRevisionFindings(revision, checks.context);
            total += 1;
            if (findings.some((f) => f.severity === 'blocking')) blocked += 1;
            for (const f of findings) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
            if (APPLY) await checks.findings.record('question', revision.id, findings);
          }
          afterId = page[page.length - 1].id;
        }
        return { total, blocked, byKind };
      });
      const rows = Object.entries(result.byKind)
        .filter(([k]) => k !== 'validation_run')
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `  ${k.padEnd(34)} ${String(v).padStart(7)}`);
      out(
        [
          `${APPLY ? 'Recorded' : '[dry] Would record'} findings for ${result.total} ${lessons ? 'lesson' : 'question'} revision(s) — ${result.blocked} with a blocking finding.`,
          ...rows,
          ...(APPLY ? [] : ['  Pass --apply to write them (the publish gate refuses revisions without a current run).']),
        ].join('\n'),
        { dryRun: !APPLY, version, ...result },
      );
    },
  },

  'migrate-wave': {
    summary:
      'import one §12.3 wave as legacy_unreviewed revisions — only AI-reviewed, not AI-rejected questions (--wave N [--allow-unreviewed] [--apply] | --rollback <report> --apply)',
    async run() {
      const rollbackFile = opt('rollback');
      if (rollbackFile) {
        const saved = JSON.parse(fs.readFileSync(rollbackFile, 'utf8')) as { wave: number; createdQuestionIds: string[] };
        if (!APPLY) {
          out(`[dry] would quarantine ${saved.createdQuestionIds.length} question(s) first created by wave ${saved.wave}. Pass --apply.`, { dryRun: true, ...saved });
          return;
        }
        const quarantined = await withContentDb((repos) => rollbackWave(repos, saved.wave, saved.createdQuestionIds));
        out(`Rolled back wave ${saved.wave}: ${quarantined} revision(s) quarantined (nothing deleted, nothing was published).`, { quarantined });
        return;
      }

      const wave = Number(opt('wave'));
      const meta = MIGRATION_WAVES.find((w) => w.wave === wave);
      if (!meta) fail('--wave must be 1–6.');
      if (wave === 6) fail('Wave 6 is the archive — it is never imported.');
      const { corpus, report } = runAudit();
      const byId = new Map<string, LegacyItem>(corpus.items.map((i) => [i.raw.id, i]));
      const candidates = report.items.filter((i) => i.wave === wave && IMPORTABLE_CLASSES.has(i.classification));
      const byClass = candidates.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.classification]: (acc[i.classification] ?? 0) + 1 }), {});

      // Content quality gate (layer 2): only questions the AI reviewer has seen, never the ones it rejected.
      const gateItems = candidates.flatMap((i) => {
        const v = validateQuestion(byId.get(i.id)!.raw);
        return v.ok ? [{ questionId: i.id, contentHash: subjectFromDraft(v.draft as RevisionDraft).contentHash }] : [];
      });
      const allowUnreviewed = flag('allow-unreviewed');
      const { isDatabaseConfigured } = await import('../../server/db/pgPool');
      const readGate = () =>
        withQualityDb(fail, async (quality) =>
          gateWave(gateItems, await quality.assessments.latestAi({ questionIds: gateItems.map((g) => g.questionId) }), { allowUnreviewed }),
        );
      let gate: WaveGateResult | null = null;
      let gateError: string | null = null;
      if (APPLY) gate = await readGate(); // fail closed: no verdicts, no import
      else if (isDatabaseConfigured()) {
        try {
          gate = await readGate();
        } catch (err) {
          gateError = (err as Error).message;
        }
      }
      const admitted = gate ? new Set(gate.admit) : null;
      const selected = admitted ? candidates.filter((i) => admitted.has(i.id)) : candidates;
      const gateLine = gate
        ? `  AI review: ${gate.admit.length} admitted, ${gate.rejected.length} rejected by the AI (skipped), ${gate.unreviewed.length} not reviewed yet${gate.unreviewed.length ? (allowUnreviewed ? ' (let through: --allow-unreviewed)' : ' (held back)') : ''}`
        : `  AI review: not checked (${gateError ?? 'no DATABASE_URL'}) — --apply requires it.`;

      if (!APPLY) {
        out(
          [
            `[dry] Wave ${wave} — ${meta.label}`,
            `  ${candidates.length} importable question(s): ${JSON.stringify(byClass)}`,
            gateLine,
            `  would import ${selected.length} as legacy_unreviewed — never published; players are unaffected until a reviewer approves + publishes in Studio.`,
            `  sample: ${selected.slice(0, 5).map((i) => i.id).join(', ')}`,
            '  Pass --apply (with DATABASE_URL) to import. Rollback: --rollback <report> --apply.',
          ].join('\n'),
          { dryRun: true, wave, count: selected.length, candidates: candidates.length, byClassification: byClass, gate: gate && { ...gate, admit: gate.admit.length, verdicts: undefined } },
        );
        return;
      }

      if (gate && gate.unreviewed.length > 0 && !allowUnreviewed) {
        fail(
          `${gate.unreviewed.length} question(s) in wave ${wave} have no current AI assessment. Run \`npm run ai -- ai-review --ids …\` (or --all) first, or pass --allow-unreviewed with the owner's approval.`,
        );
      }
      const result = await withContentDb((repos, checks) => importWave(repos, selected.map((i) => byId.get(i.id)!.raw), checks));
      const saved = {
        wave,
        label: meta.label,
        at: new Date().toISOString(),
        selected: selected.length,
        aiReview: gate && { rejected: gate.rejected, unreviewed: gate.unreviewed, byVerdict: gate.byVerdict, verdicts: gate.verdicts },
        ...result,
      };
      const path = writeReport(`wave-${wave}-${saved.at.replace(/[:.]/g, '-')}.json`, saved);
      out(
        [
          `Wave ${wave} imported: ${result.created} created, ${result.unchanged} unchanged${gate ? `; ${gate.rejected.length} AI-rejected skipped` : ''}.`,
          `  legacy_unreviewed ${result.before.legacy_unreviewed} → ${result.after.legacy_unreviewed}; published ${result.before.published} → ${result.after.published} (unchanged by design)`,
          `  Report (keep it — it is the rollback input): ${path}`,
        ].join('\n'),
        saved,
      );
    },
  },

  'import-legacy': {
    summary: 'waves 1–5 in one go (the Phase 2 importer; dry-run unless --apply)',
    async run() {
      const { corpus } = runAudit();
      if (!APPLY) {
        const { importLegacyQuestions } = await import('../../server/domains/content/import');
        const { createInMemoryContentRepositories } = await import('../../server/domains/content/inMemoryRepository');
        const r = await importLegacyQuestions(createInMemoryContentRepositories(), corpus.items.map((i) => i.raw));
        out(`[dry] created ${r.created}, quarantined ${r.quarantined}, rejected ${r.rejected.length}. Pass --apply to write.`, { dryRun: true, ...r, rejected: r.rejected.length });
        return;
      }
      const { importLegacyQuestions } = await import('../../server/domains/content/import');
      const r = await withContentDb((repos, checks) => importLegacyQuestions(repos, corpus.items.map((i) => i.raw), checks));
      out(`created ${r.created}, unchanged ${r.unchanged}, quarantined ${r.quarantined}, rejected ${r.rejected.length}`, r);
    },
  },

  'generate-questions': {
    summary: 'one AI generation → artifact (--theme id --level l [--count n] [--focus "…"] | --prompt "…" [--prompt-version v]) [--label l] [--apply]',
    async run() {
      let prompt = opt('prompt');
      let promptVersion = opt('prompt-version') ?? 'question.generate.v1';
      if (!prompt) {
        const themeId = opt('theme');
        const level = opt('level');
        const theme = THEMES.find((t) => t.id === themeId);
        if (!theme || !level || !rubricFor(level)) fail('Pass --theme <id> --level <baby…theologian> (or a free-form --prompt).');
        prompt = buildQuestionGenerationPrompt({
          themeTitle: theme.title,
          level: level as Difficulty,
          count: Number(opt('count') ?? 10),
          focus: opt('focus'),
        });
        promptVersion = GENERATION_PROMPT_VERSION;
      }
      const payload = { promptVersion, prompt, label: opt('label') ?? (opt('theme') ? `generate:${opt('theme')}:${opt('level')}` : undefined) };
      if (!APPLY) {
        out(`[dry] would run content.ai_generate with:\n${JSON.stringify(payload, null, 2)}\nPass --apply to call the provider.`, { dryRun: true, payload });
        return;
      }
      const result = await runAiJob(JOB_TYPES.AI_CONTENT_GENERATE, payload);
      out(`Job ${result.jobId}: ${result.status}${result.artifactKey ? ` → ${result.artifactKey}` : ''}${result.error ? ` (${result.error})` : ''}`, result);
    },
  },

  'repair-question': {
    summary: 'AI repair suggestion for one legacy question (--id Q --note "що не так" [--apply])',
    async run() {
      const id = opt('id');
      const note = opt('note');
      if (!id || !note) fail('--id and --note are required.');
      const item = loadLegacyCorpus().items.find((i) => i.raw.id === id);
      if (!item) fail(`No legacy question ${id}.`);
      const validation = validateQuestion(item.raw);
      if (!validation.ok) fail(`${id} is invalid (${validation.issues.join(', ')}) — fix the answer key by hand first.`);
      const prompt = buildRepairPrompt(validation.draft as unknown as QuestionRevisionRecord, { kind: 'manual', note });
      const payload = { promptVersion: REPAIR_PROMPT_VERSION, prompt, label: `repair:${id}`, questionId: id, revisionId: `legacy:${id}`, signal: 'manual' };
      if (!APPLY) {
        out(`[dry] would run content.ai_repair. Prompt:\n\n${prompt}\n\nPass --apply to call the provider.`, { dryRun: true, payload });
        return;
      }
      const result = await runAiJob(JOB_TYPES.AI_CONTENT_REPAIR, payload);
      out(`Job ${result.jobId}: ${result.status}${result.artifactKey ? ` → ${result.artifactKey}` : ''}${result.error ? ` (${result.error})` : ''}`, result);
    },
  },
};

Object.assign(
  TASKS,
  createQualityTasks({ apply: APPLY, opt, flag, out, fail, runAudit, writeReport }),
);

async function main(): Promise<void> {
  loadRootEnv();
  const t = TASKS[task];
  if (!t) {
    console.error(`Unknown task "${task}".`);
    await TASKS.help.run();
    process.exit(1);
  }
  await t.run();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
