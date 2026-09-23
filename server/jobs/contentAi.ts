/**
 * `content.ai_generate` job handler (Phase 4 §7, §8, WS1).
 *
 * Runs one AI generation call and writes the raw result to object storage as
 * an artifact — `ai-artifacts/<jobId>.json` — never to a content repository.
 * A provider "cannot write repository files directly" (§7.1); turning this
 * artifact into a `content_drafts` row with a schema/status is WS2's job, not
 * this one. Budget-exhaustion and provider failures both surface as thrown
 * errors so the job queue's own retry/backoff (`server/domains/jobs/inMemoryQueue.ts`)
 * decides what happens next — this handler does not implement its own retry loop.
 */
import { buildAuditRecord, SYSTEM_ACTOR, type AuditLog } from '../audit';
import { BudgetTracker, type AiBudget } from '../domains/ai/budget';
import { AiProviderError, type AiProvider } from '../domains/ai/types';
import type { JobHandler } from '../domains/jobs/queue';
import type { ObjectStore } from '../domains/storage/objectStore';

export interface ContentAiDeps {
  provider: AiProvider;
  store: ObjectStore;
  budget: AiBudget;
  now?: () => Date;
  /** Optional — when present, a successful generation is audited under `SYSTEM_ACTOR` (Phase 4 WS7, spec §7/§14). */
  auditLog?: AuditLog;
}

export interface ContentAiGeneratePayload {
  promptVersion: string;
  prompt: string;
  label?: string;
}

/** `content.ai_repair` (Phase 4 WS9): a generate call plus the question it is about. */
export interface ContentAiRepairPayload extends ContentAiGeneratePayload {
  questionId: string;
  revisionId: string;
  signal: string;
}

/**
 * Same single-call primitive as `content.ai_generate`, audited as
 * `content.repair` against the flagged question — the repair suggestion is
 * still only an artifact; a reviewer turns it into a draft (or doesn't).
 */
export function contentAiRepairHandler(deps: ContentAiDeps): JobHandler<ContentAiRepairPayload> {
  return runAiArtifactJob(deps, 'content.repair', (p) => ({
    questionId: p.questionId,
    revisionId: p.revisionId,
    signal: p.signal,
  }));
}

export function contentAiGenerateHandler(deps: ContentAiDeps): JobHandler<ContentAiGeneratePayload> {
  return runAiArtifactJob(deps, 'content.generate', () => ({}));
}

function runAiArtifactJob<P extends ContentAiGeneratePayload>(
  deps: ContentAiDeps,
  auditAction: string,
  extra: (payload: P) => Record<string, unknown>,
): JobHandler<P> {
  const now = deps.now ?? (() => new Date());
  return async (ctx) => {
    const priorUsage = (ctx.job.checkpoint?.usage ?? undefined) as
      | { requests: number; tokens: number; costUsd: number }
      | undefined;
    const budget = new BudgetTracker(deps.budget, priorUsage);
    if (budget.exceeded()) {
      throw new AiProviderError(`${ctx.job.type}: job budget already exhausted`, {
        kind: 'unknown',
        retryable: false,
      });
    }

    const { promptVersion, prompt, label } = ctx.job.payload;
    const result = await deps.provider.generateText({ prompt, promptVersion });
    budget.record(result.meta.usage, result.meta.costEstimate);

    const artifactKey = `ai-artifacts/${ctx.job.id}.json`;
    const body = JSON.stringify(
      {
        jobId: ctx.job.id,
        promptVersion,
        label: label ?? null,
        prompt,
        ...extra(ctx.job.payload),
        output: result.value,
        meta: result.meta,
        generatedAt: now().toISOString(),
      },
      null,
      2,
    );
    await deps.store.put(artifactKey, body, { contentType: 'application/json' });

    await ctx.checkpoint({ usage: budget.usage(), artifactKey });

    if (deps.auditLog) {
      await deps.auditLog.append(
        buildAuditRecord({
          actor: SYSTEM_ACTOR,
          action: auditAction,
          target: ctx.job.id,
          result: 'ok',
          metadata: {
            promptVersion,
            label: label ?? null,
            artifactKey,
            provider: result.meta.provider,
            ...extra(ctx.job.payload),
          },
        }),
      );
    }
  };
}
