/**
 * Content Studio — question assessments (content quality gate, WS11c/d).
 *
 * Mounted at `/api/v1/studio/assessments` behind `content:audit:read`:
 *
 * - `GET  /golden`               — the golden sample with the owner's labels and progress.
 * - `PUT  /golden/:questionId`   — `content:review`: save (replace) the label for one sample item.
 * - `GET  /calibration`          — AI verdicts vs golden labels, and whether the AI can be trusted yet.
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
import {
  ASSESSMENT_CRITERIA,
  ASSESSMENT_RUBRIC_VERSION,
  ASSESSMENT_VERDICTS,
  CRITERION_VALUES,
  assessmentRisk,
  type AssessmentCriteria,
  type AssessmentCriterion,
} from '../../src/lib/contentAssessment';
import { buildAuditRecord, type AuditActor, type AuditLog } from '../audit';
import type { Permission } from '../authz/roles';
import type { QuestionAssessment } from '../domains/quality/assessment';
import { calibrate } from '../domains/quality/calibration';
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

export function createStudioAssessmentsRouter({
  auditLog,
  quality,
  requirePermission,
  loadGoldenSample: injectedSample,
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

  return router;
}
