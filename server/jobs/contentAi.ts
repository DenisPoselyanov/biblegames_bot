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
import { BudgetTracker, type AiBudget } from '../domains/ai/budget';
import { AiProviderError, type AiProvider } from '../domains/ai/types';
import type { JobHandler } from '../domains/jobs/queue';
import type { ObjectStore } from '../domains/storage/objectStore';

export interface ContentAiDeps {
  provider: AiProvider;
  store: ObjectStore;
  budget: AiBudget;
  now?: () => Date;
}

export interface ContentAiGeneratePayload {
  promptVersion: string;
  prompt: string;
  label?: string;
}

export function contentAiGenerateHandler(deps: ContentAiDeps): JobHandler<ContentAiGeneratePayload> {
  const now = deps.now ?? (() => new Date());
  return async (ctx) => {
    const priorUsage = (ctx.job.checkpoint?.usage ?? undefined) as
      | { requests: number; tokens: number; costUsd: number }
      | undefined;
    const budget = new BudgetTracker(deps.budget, priorUsage);
    if (budget.exceeded()) {
      throw new AiProviderError('content.ai_generate: job budget already exhausted', {
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
        output: result.value,
        meta: result.meta,
        generatedAt: now().toISOString(),
      },
      null,
      2,
    );
    await deps.store.put(artifactKey, body, { contentType: 'application/json' });

    await ctx.checkpoint({ usage: budget.usage(), artifactKey });
  };
}
