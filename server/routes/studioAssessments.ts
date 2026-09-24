/**
 * Content Studio — question assessments (content quality gate, WS11c/d).
 *
 * Mounted at `/api/v1/studio/assessments` behind `content:audit:read`:
 *
 * - `GET  /golden`               — the golden sample with the owner's labels and progress.
 * - `PUT  /golden/:questionId`   — `content:review`: save (replace) the label for one sample item.
 * - `GET  /calibration`          — AI verdicts vs golden labels, and whether the AI can be trusted yet.
 * - `GET  /summary`              — AI verdict counts, undecided, decided-but-unapplied.
 * - `GET  /queue`                — layer 3: newest AI verdict per question, risk + player signals first.
 * - `GET  /ai/:id`               — one AI verdict with the owner's label (if any) and player signals.
 * - `POST /decide`               — `content:review`: accept / override / dismiss one or many verdicts;
 *                                  an accepted `repair` can also enqueue an AI repair job.
 *
 * Decisions never touch content either: `npm run ai -- apply-review-decisions`
 * writes accepted ones into the bank.
 *
 * The subject of a label always comes from the committed sample file, never from
 * the request body — a label can't be attached to a body that isn't in the set.
 * Labels never change content (§22).
 */
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { difficultySchema } from '../../contracts/index';
import { THEMES } from '../../src/data/themes';
import {
  ASSESSMENT_CRITERIA,
  ASSESSMENT_DECISIONS,
  ASSESSMENT_RUBRIC_VERSION,
  ASSESSMENT_VERDICTS,
  CRITERION_VALUES,
  assessmentRisk,
  type AssessmentCriteria,
  type AssessmentCriterion,
  type AssessmentVerdict,
} from '../../src/lib/contentAssessment';
import { buildAuditRecord, type AuditActor, type AuditLog } from '../audit';
import type { Permission } from '../authz/roles';
import { JOB_TYPES } from '../domains/jobs/catalog';
import type { JobQueue } from '../domains/jobs/queue';
import { ASSESSMENT_QUEUE_MAX_LIMIT, type AssessmentQueueFilter, type QuestionAssessment } from '../domains/quality/assessment';
import { calibrate } from '../domains/quality/calibration';
import { boostFor, loadPlayerSignals, type PlayerSignals } from '../domains/quality/playerSignals';
import { buildRepairPrompt, REPAIR_PROMPT_VERSION } from '../domains/quality/repairPrompt';
import { acceptedPatch } from '../domains/quality/reviewDecisions';
import type { GoldenSample } from '../domains/quality/goldenSample';
import type { QualityRepositories } from '../domains/quality/repository';
import { AppError } from '../lib/errors';
import { asyncHandler } from '../middleware/asyncHandler';

const DEFAULT_SAMPLE_PATH = join(dirname(fileURLToPath(import.meta.url)), '../../data/quality/golden-sample.json');

export function loadGoldenSampleFromDisk(path = DEFAULT_SAMPLE_PATH): GoldenSample | null {
  try {
    if (!fs.existsSync(path)) return null;
    return JSON.parse(fs.readFileSync(path, 'utf8')) as GoldenSample;
  } catch {
    return null;
  }
}

export interface StudioAssessmentsRouterDeps {
  auditLog: AuditLog;
  quality?: QualityRepositories;
  requirePermission: (...permissions: Permission[]) => RequestHandler;
  /** Injectable for tests; defaults to `data/quality/golden-sample.json`. */
  loadGoldenSample?: () => GoldenSample | null;
  /** For AI repair jobs on accepted `repair` verdicts; optional. */
  jobQueue?: JobQueue;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const criterionValue = z.enum(CRITERION_VALUES);
const criteriaShape = Object.fromEntries(ASSESSMENT_CRITERIA.map((c) => [c, criterionValue])) as {
  [K in AssessmentCriterion]: typeof criterionValue;
};

export const goldenLabelInput = z
  .object({
    verdict: z.enum(ASSESSMENT_VERDICTS),
    criteria: z.object(criteriaShape).strict(),
    suggestedDifficulty: difficultySchema.nullish().transform((v) => v ?? null),
    suggestedThemeId: optionalText(80),
    suggestedTopicNodeId: optionalText(200),
    suggestedExplanationShort: optionalText(600),
    suggestedExplanationDeep: optionalText(2000),
    notes: optionalText(2000),
  })
  .strict();

const actorOf = (req: { auth?: { userId: string; authSource: string } }): AuditActor => ({
  userId: req.auth?.userId ?? null,
  authSource: req.auth?.authSource ?? null,
});

/** Reviewer-facing label: everything but the internal meta bag. */
export function toLabelView(a: QuestionAssessment) {
  return {
    id: a.id,
    verdict: a.verdict,
    criteria: a.criteria,
    suggestedDifficulty: a.suggestedDifficulty,
    suggestedThemeId: a.suggestedThemeId,
    suggestedTopicNodeId: a.suggestedTopicNodeId,
    suggestedExplanationShort: a.suggestedExplanationShort,
    suggestedExplanationDeep: a.suggestedExplanationDeep,
    notes: a.notes,
    assessor: a.assessor,
    stale: false,
    updatedAt: a.updatedAt,
  };
}

const KNOWN_THEMES = new Set(THEMES.map((t) => t.id));

export const decideInput = z
  .object({
    ids: z.array(z.string().min(1).max(100)).min(1).max(ASSESSMENT_QUEUE_MAX_LIMIT),
    decision: z.enum(ASSESSMENT_DECISIONS),
    note: optionalText(1000),
    patch: z
      .object({
        difficulty: difficultySchema.optional(),
        themeId: z
          .string()
          .refine((id) => KNOWN_THEMES.has(id), 'unknown theme')
          .optional(),
        topicNodeId: z.string().trim().min(1).max(200).nullable().optional(),
        explanationShort: z.string().trim().min(1).max(600).optional(),
        explanationDeep: z.string().trim().min(1).max(2000).optional(),
        exclude: z.boolean().optional(),
      })
      .strict()
      .nullish(),
    /** Accepted `repair` verdicts: also queue an AI repair suggestion. */
    enqueueRepair: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.decision !== 'overridden' || (v.patch && Object.keys(v.patch).length > 0), {
    message: 'an override needs a patch',
    path: ['patch'],
  });

/** Reviewer-facing AI verdict: the assessment, its player signals and what accepting it would do. */
export function toAiView(a: QuestionAssessment, signals: PlayerSignals | undefined, boost: number) {
  const meta = a.meta as { verdictAdjusted?: unknown; passages?: unknown };
  return {
    id: a.id,
    questionId: a.questionId,
    contentHash: a.contentHash,
    assessor: a.assessor,
    rubricVersion: a.rubricVersion,
    verdict: a.verdict,
    criteria: a.criteria,
    confidence: a.confidence,
    risk: a.risk,
    boost,
    priority: a.risk + boost,
    signals: signals ?? null,
    suggestedDifficulty: a.suggestedDifficulty,
    suggestedThemeId: a.suggestedThemeId,
    suggestedTopicNodeId: a.suggestedTopicNodeId,
    suggestedExplanationShort: a.suggestedExplanationShort,
    suggestedExplanationDeep: a.suggestedExplanationDeep,
    notes: a.notes,
    subject: a.subject,
    acceptPatch: acceptedPatch(a),
    evidence: {
      verdictAdjusted: meta.verdictAdjusted ?? null,
      passages: Array.isArray(meta.passages) ? meta.passages : [],
    },
    decision: a.decision,
    decisionNote: a.decisionNote,
    decisionPatch: a.decisionPatch,
    decidedBy: a.decidedBy,
    decidedAt: a.decidedAt,
    appliedAt: a.appliedAt,
    createdAt: a.createdAt,
  };
}

const listParam = (v: unknown): string[] =>
  typeof v === 'string' && v.trim() ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];

export function createStudioAssessmentsRouter({
  auditLog,
  quality,
  requirePermission,
  loadGoldenSample: injectedSample,
  jobQueue,
}: StudioAssessmentsRouterDeps): Router {
  const loadGoldenSample = injectedSample ?? (() => loadGoldenSampleFromDisk());
  const router = Router();

  const requireAssessments: RequestHandler = (_req, res, next) => {
    if (!quality) {
      res.status(409).json({ error: 'assessments_unavailable' });
      return;
    }
    next();
  };

  const sampleOrThrow = (): GoldenSample => {
    const sample = loadGoldenSample();
    if (!sample) throw new AppError('golden_sample_missing', 'Run `npm run ai -- golden-sample --apply` first', 409);
    return sample;
  };

  router.get(
    '/golden',
    asyncHandler(async (_req, res) => {
      if (!quality) {
        res.json({ available: false, items: [], progress: null });
        return;
      }
      const sample = loadGoldenSample();
      if (!sample) {
        res.json({ available: true, sampleMissing: true, items: [], progress: null });
        return;
      }
      const labels = new Map((await quality.assessments.listGolden()).map((a) => [a.questionId, a]));
      const items = sample.items.map((item, index) => {
        const label = labels.get(item.subject.questionId);
        return {
          index,
          subject: item.subject,
          findings: item.findings,
          label: label
            ? { ...toLabelView(label), stale: label.contentHash !== item.subject.contentHash }
            : null,
        };
      });
      const labelled = items.filter((i) => i.label && !i.label.stale).length;
      res.json({
        available: true,
        sampleMissing: false,
        seed: sample.seed,
        items,
        progress: { labelled, total: items.length },
      });
    }),
  );

  router.put(
    '/golden/:questionId',
    requirePermission('content:review'),
    requireAssessments,
    asyncHandler(async (req, res) => {
      const parsed = goldenLabelInput.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw new AppError('invalid_label', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '), 400);
      }
      const item = sampleOrThrow().items.find((i) => i.subject.questionId === req.params.questionId);
      if (!item) throw new AppError('not_in_golden_sample', 'This question is not in the golden sample', 404);
      const actor = actorOf(req);
      const label = parsed.data;
      const criteria = label.criteria as AssessmentCriteria;
      const saved = await quality!.assessments.upsertGolden({
        questionId: item.subject.questionId,
        contentHash: item.subject.contentHash,
        source: 'golden',
        assessor: actor.userId ?? 'unknown',
        rubricVersion: ASSESSMENT_RUBRIC_VERSION,
        verdict: label.verdict,
        criteria,
        suggestedDifficulty: label.suggestedDifficulty,
        suggestedThemeId: label.suggestedThemeId,
        suggestedTopicNodeId: label.suggestedTopicNodeId,
        suggestedExplanationShort: label.suggestedExplanationShort,
        suggestedExplanationDeep: label.suggestedExplanationDeep,
        notes: label.notes,
        confidence: null,
        risk: assessmentRisk({ verdict: label.verdict, criteria, confidence: 1 }),
        subject: item.subject,
        meta: { stratum: item.stratum },
      });
      await auditLog.append(
        buildAuditRecord({
          actor,
          action: 'content.golden_label',
          target: item.subject.questionId,
          result: 'ok',
          requestId: req.id,
          metadata: { verdict: label.verdict },
        }),
      );
      res.json({ ok: true, label: toLabelView(saved) });
    }),
  );

  router.get(
    '/calibration',
    asyncHandler(async (_req, res) => {
      if (!quality) {
        res.json({ available: false, report: null });
        return;
      }
      const golden = await quality.assessments.listGolden();
      const ai = golden.length ? await quality.assessments.latestAi({ questionIds: golden.map((g) => g.questionId) }) : [];
      const report = calibrate(golden, ai);
      res.json({ available: true, report: { ...report, disagreements: report.disagreements.slice(0, 50) } });
    }),
  );

  router.get(
    '/summary',
    asyncHandler(async (_req, res) => {
      if (!quality) {
        res.json({ available: false, summary: null });
        return;
      }
      res.json({ available: true, summary: await quality.assessments.summary() });
    }),
  );

  router.get(
    '/queue',
    asyncHandler(async (req, res) => {
      if (!quality) {
        res.json({ available: false, items: [], total: 0 });
        return;
      }
      const verdicts = listParam(req.query.verdicts).filter((v): v is AssessmentVerdict =>
        (ASSESSMENT_VERDICTS as readonly string[]).includes(v),
      );
      const decided = ['undecided', 'decided', 'all'].includes(String(req.query.decided))
        ? (String(req.query.decided) as AssessmentQueueFilter['decided'])
        : 'undecided';
      const signals = await loadPlayerSignals(quality);
      const filter: AssessmentQueueFilter = {
        verdicts: verdicts.length ? verdicts : undefined,
        decided,
        themeId: typeof req.query.themeId === 'string' && req.query.themeId ? req.query.themeId : undefined,
        limit: Number(req.query.limit) || undefined,
        offset: Number(req.query.offset) || 0,
      };
      // Layer 4: "reported by players" narrows the queue to questions with any player signal.
      if (req.query.signals === '1') filter.questionIds = [...signals.keys()];
      const { items, total } = await quality.assessments.queue(filter);
      // Risk orders the page; player signals raise items within it (they keep arriving after the verdict).
      const views = items
        .map((a) => toAiView(a, signals.get(a.questionId), boostFor(signals, a.questionId)))
        .sort((x, y) => y.priority - x.priority);
      res.json({ available: true, items: views, total });
    }),
  );

  router.get(
    '/ai/:id',
    requireAssessments,
    asyncHandler(async (req, res) => {
      const a = await quality!.assessments.getById(req.params.id);
      if (!a || a.source !== 'ai') throw new AppError('assessment_not_found', 'No such AI assessment', 404);
      const [signals, golden] = await Promise.all([loadPlayerSignals(quality!), quality!.assessments.listGolden()]);
      const label = golden.find((g) => g.questionId === a.questionId);
      res.json({
        assessment: toAiView(a, signals.get(a.questionId), boostFor(signals, a.questionId)),
        golden: label ? { ...toLabelView(label), stale: label.contentHash !== a.contentHash } : null,
      });
    }),
  );

  router.post(
    '/decide',
    requirePermission('content:review'),
    requireAssessments,
    asyncHandler(async (req, res) => {
      const parsed = decideInput.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw new AppError('invalid_decision', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '), 400);
      }
      const input = parsed.data;
      const actor = actorOf(req);
      // Accepted `repair` verdicts the reviewer wants an AI repair suggestion for — checked before anything is written.
      const toRepair: QuestionAssessment[] = [];
      if (input.enqueueRepair && input.decision === 'accepted') {
        for (const id of input.ids) {
          const a = await quality!.assessments.getById(id);
          if (a && a.source === 'ai' && a.verdict === 'repair') toRepair.push(a);
        }
        if (toRepair.length && !jobQueue) throw new AppError('queue_unavailable', 'No job queue in this process', 409);
      }
      const changed = await quality!.assessments.decide({
        ids: input.ids,
        decision: input.decision,
        decidedBy: actor.userId ?? 'unknown',
        note: input.note,
        patch: input.decision === 'overridden' ? (input.patch ?? null) : null,
      });

      const repairJobs: Array<{ questionId: string; jobId: string }> = [];
      if (jobQueue) {
        for (const a of toRepair) {
          const failed = ASSESSMENT_CRITERIA.filter((c) => a.criteria[c] === 'fail');
          const { id: jobId } = await jobQueue.enqueue(JOB_TYPES.AI_CONTENT_REPAIR, {
            promptVersion: REPAIR_PROMPT_VERSION,
            prompt: buildRepairPrompt(a.subject, { kind: 'ai_review', failed, notes: a.notes }),
            label: `repair:${a.questionId}`,
            questionId: a.questionId,
            revisionId: `assessment:${a.id}`,
            signal: 'ai_review',
          });
          repairJobs.push({ questionId: a.questionId, jobId });
        }
      }

      await auditLog.append(
        buildAuditRecord({
          actor,
          action: 'content.ai_review_decision',
          target: input.ids.length === 1 ? input.ids[0] : `${input.ids.length} assessments`,
          result: 'ok',
          requestId: req.id,
          metadata: {
            decision: input.decision,
            count: changed,
            ids: input.ids.slice(0, 50),
            ...(input.patch ? { patch: input.patch } : {}),
            ...(repairJobs.length ? { repairJobs: repairJobs.map((j) => j.jobId) } : {}),
          },
        }),
      );
      res.json({ ok: true, changed, repairJobs });
    }),
  );

  return router;
}
