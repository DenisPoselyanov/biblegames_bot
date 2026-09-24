/**
 * Content quality gate tasks for `npm run ai -- <task>` (WS11c/d, layers 2–3).
 * Same rules as every CLI task: dry-run by default, `--apply` to write,
 * `--json` for machine output. Kept apart from `cli.ts` so the gate's tasks
 * read as one unit.
 */
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { IMPORTABLE_CLASSES, type LegacyAuditReport, type LegacyItem } from '../../server/domains/content/legacyAudit';
import { validateQuestion } from '../../server/domains/content/validation';
import type { RevisionDraft } from '../../server/domains/content/types';
import {
  ASSESSMENT_CRITERIA,
  ASSESSMENT_RUBRIC_VERSION,
  ASSESSMENT_VERDICTS,
  type AssessmentSubject,
} from '../../src/lib/contentAssessment';
import { calibrate } from '../../server/domains/quality/calibration';
import type { QuestionAssessment } from '../../server/domains/quality/assessment';
import { planReviewApplication, type ReviewApplicationPlan } from '../../server/domains/quality/reviewDecisions';
import type { ContentRepositories } from '../../server/domains/content/repository';
import { validateQuestionRevision, type RevisionValidationDeps } from '../../server/domains/content/revisionValidation';
import {
  loadExclusionsFromDisk,
  loadOverridesFromDisk,
  saveExclusionsToDisk,
  saveOverridesToDisk,
} from '../../server/questionMutations';
import { THEMES } from '../../src/data/themes';
import { runAiReview, subjectKey, type TokenPricing } from '../../server/domains/quality/aiReview';
import { buildAiReviewPrompt, fetchReviewPassages } from '../../server/domains/quality/aiReviewPrompt';
import { subjectFromDraft } from '../../server/domains/quality/assessmentSubject';
import { boostFor, loadPlayerSignals } from '../../server/domains/quality/playerSignals';
import type { QualityRepositories } from '../../server/domains/quality/repository';
import { loadConfig } from '../../server/config/env';
import { createAiProvider } from '../../server/infrastructure/ai';
import { createBollsSourceAdapter } from '../../server/infrastructure/scripture/bollsSourceAdapter';
import {
  buildGoldenSample,
  GOLDEN_STRATUM_LABELS,
  type GoldenCandidate,
  type GoldenSample,
} from '../../server/domains/quality/goldenSample';
import { ROOT } from '../content/legacyCorpus';

export const GOLDEN_SAMPLE_PATH = join(ROOT, 'data/quality/golden-sample.json');

export interface QualityTaskContext {
  apply: boolean;
  opt: (name: string) => string | undefined;
  flag: (name: string) => boolean;
  out: (human: string, machine: unknown) => void;
  fail: (message: string) => never;
  runAudit: () => { corpus: { items: LegacyItem[] }; report: LegacyAuditReport };
  writeReport: (name: string, data: unknown) => string;
}

type Task = { summary: string; run: () => Promise<void> };

/** Importable legacy items as assessment candidates (subject + deterministic finding kinds). */
export function legacyCandidates(ctx: QualityTaskContext): GoldenCandidate[] {
  const { corpus, report } = ctx.runAudit();
  const byId = new Map(report.items.map((i) => [i.id, i]));
  const out: GoldenCandidate[] = [];
  for (const item of corpus.items) {
    const audit = byId.get(item.raw.id);
    if (!audit || !IMPORTABLE_CLASSES.has(audit.classification)) continue;
    const validation = validateQuestion(item.raw);
    if (!validation.ok) continue;
    out.push({ subject: subjectFromDraft(validation.draft as RevisionDraft), findings: audit.findings });
  }
  return out;
}

export function readGoldenSample(path = GOLDEN_SAMPLE_PATH): GoldenSample | null {
  if (!fs.existsSync(path)) return null;
  return JSON.parse(fs.readFileSync(path, 'utf8')) as GoldenSample;
}

/** Content-quality repositories on the configured database (DATABASE_URL). */
export async function withQualityDb<T>(
  fail: (message: string) => never,
  fn: (quality: QualityRepositories) => Promise<T>,
): Promise<T> {
  const { getPool, isDatabaseConfigured } = await import('../../server/db/pgPool');
  if (!isDatabaseConfigured()) fail('DATABASE_URL is required for this task.');
  const { createDatabase } = await import('../../server/infrastructure/database/client');
  const { createSqlQualityRepositories } = await import('../../server/infrastructure/database/repositories/quality');
  const pool = await getPool();
  try {
    return await fn(createSqlQualityRepositories(createDatabase(pool)));
  } finally {
    await pool.end();
  }
}

/** Quality + content repositories on one database connection (DATABASE_URL). */
async function withGateDb<T>(
  fail: (message: string) => never,
  fn: (quality: QualityRepositories, content: ContentRepositories, checks: RevisionValidationDeps) => Promise<T>,
): Promise<T> {
  const { getPool, isDatabaseConfigured } = await import('../../server/db/pgPool');
  if (!isDatabaseConfigured()) fail('DATABASE_URL is required for this task.');
  const { createDatabase } = await import('../../server/infrastructure/database/client');
  const { createSqlQualityRepositories } = await import('../../server/infrastructure/database/repositories/quality');
  const { createSqlContentRepositories } = await import('../../server/infrastructure/database/repositories/content');
  const { createSqlValidationFindingRepository } = await import('../../server/infrastructure/database/repositories/validationFindings');
  const pool = await getPool();
  try {
    const database = createDatabase(pool);
    const checks: RevisionValidationDeps = {
      findings: createSqlValidationFindingRepository(database),
      context: { siblings: [], knownThemeIds: THEMES.map((t) => t.id) },
    };
    return await fn(createSqlQualityRepositories(database), createSqlContentRepositories(database), checks);
  } finally {
    await pool.end();
  }
}

/**
 * Imported questions get the same decision as a revision: a reject quarantines
 * every revision of the question; a patch becomes a new *draft* revision (goes
 * through Studio review, never published here), with its findings recorded.
 */
async function applyPlanToRevisions(
  plan: ReviewApplicationPlan,
  content: ContentRepositories,
  checks: RevisionValidationDeps,
): Promise<{ quarantined: number; drafts: number }> {
  let quarantined = 0;
  let drafts = 0;
  for (const questionId of plan.exclude) {
    quarantined += await content.revisions.quarantine({ questionId, reason: 'AI review: rejected by reviewer' });
  }
  for (const [questionId, patch] of Object.entries(plan.overrides)) {
    const [latest] = await content.revisions.listRevisions(questionId);
    if (!latest) continue;
    const outcome = await content.revisions.appendRevision({
      questionId,
      themeId: patch.themeId ?? latest.themeId,
      difficulty: patch.difficulty ?? latest.difficulty,
      topicNodeId: patch.topicNodeId ?? latest.topicNodeId,
      topicPath: latest.topicPath,
      text: latest.text,
      options: latest.options,
      correctIndex: latest.correctIndex,
      explanationShort: patch.explanationShort ?? latest.explanationShort,
      explanationDeep: patch.explanationDeep ?? latest.explanationDeep,
      reference: latest.reference,
      scriptureRefs: latest.scriptureRefs,
      tags: latest.tags,
      source: 'ai_review_decision',
      status: 'draft',
    });
    if (outcome.kind === 'created') {
      drafts += 1;
      await validateQuestionRevision(checks, outcome.revision);
    }
  }
  return { quarantined, drafts };
}

/** Rough per-question token use of the reviewer prompt — for the dry-run estimate only. */
const EST_TOKENS_IN = 2600;
const EST_TOKENS_OUT = 350;

/** Which questions a quality task runs over: --golden | --ids a,b | --theme id | --all. */
function selectSubjects(ctx: QualityTaskContext): { label: string; subjects: AssessmentSubject[] } {
  if (ctx.flag('golden')) {
    const sample = readGoldenSample();
    if (!sample) ctx.fail(`${GOLDEN_SAMPLE_PATH} is missing — run \`npm run ai -- golden-sample --apply\` first.`);
    return { label: 'golden sample', subjects: sample.items.map((i) => i.subject) };
  }
  const ids = ctx.opt('ids');
  const theme = ctx.opt('theme');
  if (!ids && !theme && !ctx.flag('all')) ctx.fail('Pick the questions: --golden | --ids a,b | --theme <id> | --all.');
  let subjects = legacyCandidates(ctx).map((c) => c.subject);
  if (ids) {
    const wanted = new Set(ids.split(',').map((s) => s.trim()).filter(Boolean));
    subjects = subjects.filter((s) => wanted.has(s.questionId));
  }
  if (theme) subjects = subjects.filter((s) => s.themeId === theme);
  return { label: ids ? `ids (${subjects.length})` : theme ? `theme ${theme}` : 'whole bank', subjects };
}

export function createQualityTasks(ctx: QualityTaskContext): Record<string, Task> {
  return {
    'golden-sample': {
      summary: 'draw the ~200-question golden set for owner labelling → data/quality/golden-sample.json ([--size 200] [--seed s] [--apply])',
      async run() {
        const existing = readGoldenSample();
        if (existing && ctx.apply && !ctx.flag('force')) {
          ctx.fail(`${GOLDEN_SAMPLE_PATH} already exists (${existing.size} items). Labels are bound to it — pass --force to redraw.`);
        }
        const sample = buildGoldenSample(legacyCandidates(ctx), {
          size: Number(ctx.opt('size') ?? 200),
          seed: ctx.opt('seed'),
        });
        const lines = Object.entries(sample.byStratum).map(
          ([s, n]) => `  ${GOLDEN_STRATUM_LABELS[s as keyof typeof GOLDEN_STRATUM_LABELS].padEnd(24)} ${n}`,
        );
        const human = [`Golden sample: ${sample.size} items (seed ${sample.seed})`, ...lines].join('\n');
        if (!ctx.apply) {
          ctx.out(`[dry] ${human}\nPass --apply to write ${GOLDEN_SAMPLE_PATH}.`, { dryRun: true, ...sample, items: sample.items.length });
          return;
        }
        fs.mkdirSync(dirname(GOLDEN_SAMPLE_PATH), { recursive: true });
        fs.writeFileSync(GOLDEN_SAMPLE_PATH, `${JSON.stringify(sample, null, 2)}\n`);
        ctx.out(`${human}\n→ ${GOLDEN_SAMPLE_PATH}`, { path: GOLDEN_SAMPLE_PATH, byStratum: sample.byStratum, size: sample.size });
      },
    },

    'ai-review': {
      summary:
        'AI reviewer (layer 2) → question_assessments (--golden | --ids a,b | --theme id | --all) [--signals-first] [--limit n] [--concurrency 4] [--max-usd 5] [--apply]',
      async run() {
        const selected = selectSubjects(ctx);
        let subjects = selected.subjects;
        const limit = ctx.opt('limit') ? Math.max(1, Number(ctx.opt('limit'))) : undefined;
        const pricing: TokenPricing = {
          inputPerMTok: Number(ctx.opt('usd-per-mtok-in') ?? 0.1),
          outputPerMTok: Number(ctx.opt('usd-per-mtok-out') ?? 0.4),
        };
        const maxUsd = Number(ctx.opt('max-usd') ?? 5);
        const scripture = createBollsSourceAdapter();

        if (!ctx.apply) {
          const n = limit ? Math.min(limit, subjects.length) : subjects.length;
          const est = (n * (EST_TOKENS_IN * pricing.inputPerMTok + EST_TOKENS_OUT * pricing.outputPerMTok)) / 1_000_000;
          const first = subjects[0];
          const prompt = first
            ? buildAiReviewPrompt(first, await fetchReviewPassages(first.reference, scripture))
            : '(no questions selected)';
          ctx.out(
            [
              `[dry] AI review of ${n} question(s) from ${selected.label}, rubric ${ASSESSMENT_RUBRIC_VERSION}.`,
              `  estimated cost ≈ $${est.toFixed(2)} (budget stop at $${maxUsd}); already-reviewed items are skipped on --apply.`,
              '',
              `Prompt for ${first?.questionId ?? '—'}:`,
              '',
              prompt,
              '',
              'Pass --apply (with DATABASE_URL and an AI provider) to run it.',
            ].join('\n'),
            { dryRun: true, count: n, estimatedUsd: est, prompt },
          );
          return;
        }

        const { config } = loadConfig();
        const provider = createAiProvider(config);
        if (!provider) ctx.fail(`No AI provider configured (CONTENT_AI_PROVIDER=${config.aiProvider}). See docs/AI_SETUP.md.`);
        const summary = await withQualityDb(ctx.fail, async (quality) => {
          if (ctx.flag('all') && !ctx.flag('skip-trust-gate')) {
            const golden = await quality.assessments.listGolden();
            const ai = golden.length ? await quality.assessments.latestAi({ questionIds: golden.map((g) => g.questionId) }) : [];
            const calibration = calibrate(golden, ai);
            if (!calibration.trusted) {
              ctx.fail(
                `The AI reviewer is not calibrated yet (${calibration.gateFailures.join('; ')}). Run \`ai-review --golden --apply\` + \`ai-calibrate\` first, or pass --skip-trust-gate with the owner's approval.`,
              );
            }
          }
          if (ctx.flag('signals-first')) {
            const signals = await loadPlayerSignals(quality);
            subjects = [...subjects].sort((a, b) => boostFor(signals, b.questionId) - boostFor(signals, a.questionId));
          }
          const skipKeys = await quality.assessments.aiKeys(ASSESSMENT_RUBRIC_VERSION);
          const pending = subjects.filter((s) => !skipKeys.has(subjectKey(s)));
          const batch = limit ? pending.slice(0, limit) : pending;
          console.error(`Reviewing ${batch.length} question(s) (${subjects.length - pending.length} already reviewed)…`);
          const result = await runAiReview({
            subjects: batch,
            repo: quality.assessments,
            deps: { provider, scripture, pricing },
            concurrency: Number(ctx.opt('concurrency') ?? 4),
            maxUsd,
            onItem: (e) => {
              if (e.error) console.error(`  ✖ ${e.questionId}: ${e.error}`);
              else if ((e.index + 1) % 25 === 0) console.error(`  … ${e.index + 1}/${e.total}`);
            },
          });
          return { ...result, alreadyReviewed: subjects.length - pending.length };
        });
        const at = new Date().toISOString();
        const path = ctx.writeReport(`ai-review-${at.replace(/[:.]/g, '-')}.json`, { at, selection: selected.label, ...summary });
        ctx.out(
          [
            `AI review (${selected.label}): ${summary.reviewed} reviewed, ${summary.failed} failed, ${summary.alreadyReviewed} already reviewed — stop: ${summary.stopReason}.`,
            `  verdicts: ${Object.entries(summary.byVerdict).map(([v, n]) => `${v} ${n}`).join(' · ') || '—'}; raised to the criteria: ${summary.adjusted}`,
            `  ≈ $${summary.costUsd.toFixed(3)}, ${summary.tokens} tokens. Report: ${path}`,
            summary.stopReason === 'budget' ? '  Budget reached — rerun with a higher --max-usd to continue (reviewed items are skipped).' : '',
          ]
            .filter(Boolean)
            .join('\n'),
          { ...summary, report: path },
        );
      },
    },

    'apply-review-decisions': {
      summary:
        'write accepted/overridden AI-review decisions into the bank: rejects → question-exclusions.json, level/theme/explanations → question-overrides.json, imported revisions → quarantine / draft ([--apply])',
      async run() {
        const current = new Map(legacyCandidates(ctx).map((c) => [c.subject.questionId, c.subject.contentHash]));
        const result = await withGateDb(ctx.fail, async (quality, content, checks) => {
          const decided: QuestionAssessment[] = [];
          for (let offset = 0; ; offset += 500) {
            const page = await quality.assessments.queue({
              verdicts: ['pass', 'reclassify', 'repair', 'reject'],
              decided: 'decided',
              unappliedOnly: true,
              limit: 500,
              offset,
            });
            decided.push(...page.items);
            if (page.items.length < 500) break;
          }
          // Questions no longer in the file bank may still live as revisions.
          const revisionHash = new Map<string, string>();
          for (const a of decided) {
            if (current.has(a.questionId)) continue;
            const [latest] = await content.revisions.listRevisions(a.questionId);
            if (latest) revisionHash.set(a.questionId, latest.contentHash);
          }
          const plan = planReviewApplication(decided, (id) => current.get(id) ?? revisionHash.get(id) ?? null);
          if (!ctx.apply) return { plan, decided: decided.length, revisions: null };

          const exclusions = new Set(loadExclusionsFromDisk());
          for (const id of plan.exclude) exclusions.add(id);
          saveExclusionsToDisk([...exclusions]);
          const overrides = loadOverridesFromDisk();
          for (const [id, patch] of Object.entries(plan.overrides)) overrides[id] = { ...overrides[id], ...patch };
          saveOverridesToDisk(overrides);
          const revisions = await applyPlanToRevisions(plan, content, checks);
          await quality.assessments.markApplied(plan.applied, new Date().toISOString());
          return { plan, decided: decided.length, revisions };
        });
        const { plan } = result;
        const stale = plan.skipped.filter((s) => s.reason === 'stale').length;
        const gone = plan.skipped.length - stale;
        const at = new Date().toISOString();
        const path = ctx.writeReport(`review-decisions-${at.replace(/[:.]/g, '-')}.json`, { at, dryRun: !ctx.apply, ...result });
        ctx.out(
          [
            `${ctx.apply ? 'Applied' : '[dry] Would apply'} ${plan.applied.length} of ${result.decided} decided verdict(s): ${plan.exclude.length} excluded from play, ${Object.keys(plan.overrides).length} question(s) patched, ${plan.applied.length - plan.changed.length} with nothing to write.`,
            stale || gone ? `  skipped: ${stale} stale (question changed since the review — re-review it), ${gone} not in the bank` : '',
            result.revisions ? `  revisions: ${result.revisions.quarantined} quarantined, ${result.revisions.drafts} draft(s) for Studio review` : '',
            ctx.apply
              ? '  → data/question-exclusions.json, data/question-overrides.json (commit and deploy them to reach players).'
              : '  Pass --apply to write data/question-exclusions.json + data/question-overrides.json.',
            `  Report: ${path}`,
          ]
            .filter(Boolean)
            .join('\n'),
          { dryRun: !ctx.apply, ...result, report: path },
        );
      },
    },

    'ai-calibrate': {
      summary: 'AI verdicts vs the owner\'s golden labels: agreement, confusion matrix, reject recall, trust gate → reports/content/',
      async run() {
        const report = await withQualityDb(ctx.fail, async (quality) => {
          const golden = await quality.assessments.listGolden();
          const ai = golden.length ? await quality.assessments.latestAi({ questionIds: golden.map((g) => g.questionId) }) : [];
          return calibrate(golden, ai);
        });
        const at = new Date().toISOString();
        const path = ctx.writeReport(`calibration-${at.replace(/[:.]/g, '-')}.json`, { at, ...report });
        const pc = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(0)}%`);
        const matrix = ASSESSMENT_VERDICTS.map(
          (g) => `  ${g.padEnd(11)} ${ASSESSMENT_VERDICTS.map((a) => String(report.confusion[g][a]).padStart(8)).join('')}`,
        );
        const criteria = ASSESSMENT_CRITERIA.map((c) => {
          const s = report.byCriterion[c];
          return `  ${c.padEnd(17)} agreement ${pc(s.agreement).padStart(5)}   fails caught ${pc(s.failRecall).padStart(5)} of ${s.goldenFails}`;
        });
        ctx.out(
          [
            `Calibration: ${report.pairs} pair(s) of ${report.goldenLabels} golden label(s)${report.missingAi ? ` — ${report.missingAi} without an AI verdict yet` : ''}.`,
            `  verdict agreement ${pc(report.verdictAgreement)} · reject recall ${pc(report.byVerdict.reject.recall)} · reject precision ${pc(report.byVerdict.reject.precision)} · problems flagged ${pc(report.flagRecall)}`,
            '',
            `  owner \\ AI ${ASSESSMENT_VERDICTS.map((v) => v.padStart(8)).join('')}`,
            ...matrix,
            '',
            ...criteria,
            '',
            report.trusted
              ? '✔ Trust gate passed — a full `ai-review --all` run is allowed.'
              : `✖ Not trusted yet: ${report.gateFailures.join('; ')}.`,
            `Report (with every disagreement): ${path}`,
          ].join('\n'),
          { ...report, report: path },
        );
      },
    },
  };
}
