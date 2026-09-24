/**
 * AI reviewer (content quality gate, layer 2): one question body in, one
 * `ai` assessment out — grounded in the verse text fetched from a trusted
 * source, judged by the same eight criteria as the owner's golden labels.
 *
 * Fail closed: the stored verdict is never more lenient than the criteria
 * imply (`impliedVerdict`). A model that marks a criterion `fail` and still
 * says `pass` gets its verdict raised, and `meta.verdictAdjusted` records it.
 *
 * The reviewer never changes content (§7.1, §22): it writes assessments only;
 * applying accepted decisions is `apply-review-decisions`.
 */
import { THEMES } from '../../../src/data/themes';
import {
  ASSESSMENT_RUBRIC_VERSION,
  assessmentRisk,
  impliedVerdict,
  type AssessmentCriteria,
  type AssessmentSubject,
  type AssessmentVerdict,
} from '../../../src/lib/contentAssessment';
import { BudgetTracker } from '../ai/budget';
import { AiProviderError, type AiProvider, type AiUsage } from '../ai/types';
import type { ScriptureSourceAdapter } from '../content/scriptureSourceAdapter';
import type { AssessmentRepository, NewAssessment } from './assessment';
import {
  AI_REVIEW_PROMPT_VERSION,
  aiReviewOutputSchema,
  buildAiReviewPrompt,
  fetchReviewPassages,
  type AiReviewOutput,
} from './aiReviewPrompt';

export const VERDICT_SEVERITY: Record<AssessmentVerdict, number> = { pass: 0, reclassify: 1, repair: 2, reject: 3 };

export function stricterVerdict(a: AssessmentVerdict, b: AssessmentVerdict): AssessmentVerdict {
  return VERDICT_SEVERITY[a] >= VERDICT_SEVERITY[b] ? a : b;
}

/** USD per million tokens — an estimate for `--max-usd`; providers don't report cost. */
export interface TokenPricing {
  inputPerMTok: number;
  outputPerMTok: number;
}

export function estimateCostUsd(usage: AiUsage | undefined, pricing: TokenPricing | undefined): number {
  if (!usage || !pricing) return 0;
  const input = usage.promptTokens ?? 0;
  const output = usage.completionTokens ?? Math.max(0, (usage.totalTokens ?? 0) - input);
  return (input * pricing.inputPerMTok + output * pricing.outputPerMTok) / 1_000_000;
}

export interface AiReviewDeps {
  provider: AiProvider;
  scripture: ScriptureSourceAdapter;
  pricing?: TokenPricing;
}

const KNOWN_THEMES = new Set(THEMES.map((t) => t.id));

const trimOrNull = (v: string | null | undefined, max: number): string | null => {
  const s = (v ?? '').trim();
  return s ? s.slice(0, max) : null;
};

/** Raw model output → a storable assessment (clamped, trimmed, verdict escalated). */
export function assessmentFromOutput(
  subject: AssessmentSubject,
  output: AiReviewOutput,
  meta: { assessor: string; extra: Record<string, unknown> },
): NewAssessment {
  const criteria = output.criteria as AssessmentCriteria;
  const implied = impliedVerdict(criteria);
  const verdict = stricterVerdict(output.verdict, implied);
  const confidence = Number.isFinite(output.confidence) ? Math.min(1, Math.max(0, output.confidence)) : 0.5;
  const suggestedThemeId =
    output.suggestedThemeId && KNOWN_THEMES.has(output.suggestedThemeId) && output.suggestedThemeId !== subject.themeId
      ? output.suggestedThemeId
      : null;
  const suggestedDifficulty =
    output.suggestedDifficulty && output.suggestedDifficulty !== subject.difficulty ? output.suggestedDifficulty : null;
  return {
    questionId: subject.questionId,
    contentHash: subject.contentHash,
    source: 'ai',
    assessor: meta.assessor,
    rubricVersion: ASSESSMENT_RUBRIC_VERSION,
    verdict,
    criteria,
    suggestedDifficulty,
    suggestedThemeId,
    suggestedTopicNodeId: null,
    suggestedExplanationShort: trimOrNull(output.suggestedExplanationShort, 600),
    suggestedExplanationDeep: trimOrNull(output.suggestedExplanationDeep, 2000),
    notes: trimOrNull(output.notes, 400),
    confidence,
    risk: assessmentRisk({ verdict, criteria, confidence }),
    subject,
    meta: {
      ...meta.extra,
      promptVersion: AI_REVIEW_PROMPT_VERSION,
      ...(verdict !== output.verdict ? { verdictAdjusted: { from: output.verdict, to: verdict } } : {}),
    },
  };
}

export interface ReviewedSubject {
  assessment: NewAssessment;
  usage: AiUsage | undefined;
  costUsd: number;
}

/** Review one question. Provider errors propagate (`AiProviderError`) — the caller decides on retries. */
export async function reviewSubject(subject: AssessmentSubject, deps: AiReviewDeps): Promise<ReviewedSubject> {
  const passages = await fetchReviewPassages(subject.reference, deps.scripture);
  const prompt = buildAiReviewPrompt(subject, passages);
  const result = await deps.provider.generateObject({
    prompt,
    promptVersion: AI_REVIEW_PROMPT_VERSION,
    schema: aiReviewOutputSchema,
    temperature: 0.2,
    maxOutputTokens: 2048,
  });
  const costUsd = result.meta.costEstimate ?? estimateCostUsd(result.meta.usage, deps.pricing);
  const assessment = assessmentFromOutput(subject, result.value, {
    assessor: `${result.meta.provider}:${result.meta.model}`,
    extra: {
      provider: result.meta.provider,
      model: result.meta.model,
      requestId: result.meta.requestId,
      durationMs: result.meta.durationMs,
      usage: result.meta.usage ?? null,
      costUsd,
      scriptureSource: deps.scripture.version,
      passages: passages.map((p) => ({ label: p.label, found: p.text !== null, ...(p.note ? { note: p.note } : {}) })),
    },
  });
  return { assessment, usage: result.meta.usage, costUsd };
}

/** `${questionId}:${contentHash}` — the resumability key `AssessmentRepository.aiKeys` returns. */
export const subjectKey = (s: Pick<AssessmentSubject, 'questionId' | 'contentHash'>): string =>
  `${s.questionId}:${s.contentHash}`;

export interface AiReviewRunOptions {
  subjects: readonly AssessmentSubject[];
  repo: AssessmentRepository;
  deps: AiReviewDeps;
  /** Already reviewed with the current rubric — skipped (resumable runs). */
  skipKeys?: ReadonlySet<string>;
  concurrency?: number;
  maxUsd?: number;
  maxRequests?: number;
  /** Retries per item for retryable provider errors (rate limit, timeout). */
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
  onItem?: (event: { index: number; total: number; questionId: string; verdict?: AssessmentVerdict; error?: string }) => void;
}

export type AiReviewStopReason = 'done' | 'budget' | 'auth';

export interface AiReviewRunSummary {
  total: number;
  skipped: number;
  reviewed: number;
  failed: number;
  stopReason: AiReviewStopReason;
  byVerdict: Partial<Record<AssessmentVerdict, number>>;
  /** Verdicts raised to what the criteria imply. */
  adjusted: number;
  costUsd: number;
  tokens: number;
  failures: Array<{ questionId: string; error: string }>;
}

/**
 * Review many questions with bounded concurrency, a hard budget stop and
 * per-item retries. Each verdict is stored as soon as it arrives, so an
 * interrupted run resumes by skipping `skipKeys`.
 */
export async function runAiReview(options: AiReviewRunOptions): Promise<AiReviewRunSummary> {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxRetries = options.maxRetries ?? 2;
  const skip = options.skipKeys ?? new Set<string>();
  const todo = options.subjects.filter((s) => !skip.has(subjectKey(s)));
  const budget = new BudgetTracker({ maxCostUsd: options.maxUsd, maxRequests: options.maxRequests });
  const summary: AiReviewRunSummary = {
    total: options.subjects.length,
    skipped: options.subjects.length - todo.length,
    reviewed: 0,
    failed: 0,
    stopReason: 'done',
    byVerdict: {},
    adjusted: 0,
    costUsd: 0,
    tokens: 0,
    failures: [],
  };

  let next = 0;
  let stopped = false;
  const worker = async (): Promise<void> => {
    while (!stopped && next < todo.length) {
      if (budget.exceeded()) {
        summary.stopReason = 'budget';
        stopped = true;
        return;
      }
      const index = next;
      next += 1;
      const subject = todo[index];
      for (let attempt = 0; ; attempt += 1) {
        try {
          const reviewed = await reviewSubject(subject, options.deps);
          budget.record(reviewed.usage, reviewed.costUsd);
          await options.repo.addAi(reviewed.assessment);
          summary.reviewed += 1;
          summary.costUsd += reviewed.costUsd;
          summary.tokens += reviewed.usage?.totalTokens ?? 0;
          const v = reviewed.assessment.verdict;
          summary.byVerdict[v] = (summary.byVerdict[v] ?? 0) + 1;
          if (reviewed.assessment.meta.verdictAdjusted) summary.adjusted += 1;
          options.onItem?.({ index, total: todo.length, questionId: subject.questionId, verdict: v });
          break;
        } catch (err) {
          const e = err instanceof AiProviderError ? err : null;
          if (e?.kind === 'auth') {
            summary.stopReason = 'auth';
            stopped = true;
            summary.failures.push({ questionId: subject.questionId, error: e.message });
            summary.failed += 1;
            return;
          }
          if (e?.retryable && attempt < maxRetries) {
            await sleep(e.retryAfterMs ?? 2000 * (attempt + 1));
            continue;
          }
          const message = (err as Error).message ?? String(err);
          summary.failed += 1;
          summary.failures.push({ questionId: subject.questionId, error: message });
          options.onItem?.({ index, total: todo.length, questionId: subject.questionId, error: message });
          break;
        }
      }
    }
  };

  const concurrency = Math.max(1, Math.min(16, Math.floor(options.concurrency ?? 4)));
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return summary;
}
