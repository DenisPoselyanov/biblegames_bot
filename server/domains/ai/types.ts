/**
 * `AiProvider` — the contract every text/object-generation provider implements
 * (Phase 4 §7.1). Domain-owned: no network, no `fetch`, no provider SDKs — pure
 * types plus the error/result shapes every adapter must produce.
 *
 * A provider never writes to any repository or publishes content (§7.1,
 * §22 "AI auto-publish" is forbidden) — it only turns a prompt into text or a
 * validated object and reports what happened. Adapters live in
 * `server/infrastructure/ai/` (`geminiProvider.ts`, `openAiCompatibleProvider.ts`
 * for Groq/OpenRouter, `mockProvider.ts` for deterministic tests).
 */
import type { z } from 'zod';

/** Why a call failed, and whether the job queue's own retry/backoff should retry it. */
export type AiErrorKind = 'auth' | 'rate_limited' | 'timeout' | 'invalid_response' | 'unknown';

/**
 * Thrown by providers on failure. The job handler that calls a provider
 * decides what to do with `retryable` — it rethrows for the `JobQueue`'s own
 * backoff to handle rather than sleeping/retrying inside the provider itself
 * (§8.2 "explicit retryable vs non-retryable errors"; no duplicate retry loop).
 */
export class AiProviderError extends Error {
  readonly kind: AiErrorKind;
  readonly retryable: boolean;
  /** Present for `rate_limited` when the provider states a cooldown. */
  readonly retryAfterMs?: number;

  constructor(
    message: string,
    options: { kind: AiErrorKind; retryable: boolean; retryAfterMs?: number },
  ) {
    super(message);
    this.name = 'AiProviderError';
    this.kind = options.kind;
    this.retryable = options.retryable;
    this.retryAfterMs = options.retryAfterMs;
  }
}

export interface AiUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AiResultMeta {
  provider: string;
  model: string;
  /** Provider-issued or locally generated correlation id for this call. */
  requestId: string;
  /** 1-based attempt number within the caller's own retry loop, if any. Providers report 1. */
  attempt: number;
  durationMs: number;
  usage?: AiUsage;
  warnings: string[];
  finishReason?: string;
  /** USD, when the provider/adapter can estimate it. Absent for free-tier calls. */
  costEstimate?: number;
}

export interface AiResult<T> {
  value: T;
  meta: AiResultMeta;
}

export interface TextGenerationRequest {
  prompt: string;
  /** Versioned prompt/template id this request implements (§7.3) — stored with the result. */
  promptVersion: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Default per-adapter; adapters should not hang indefinitely. */
  timeoutMs?: number;
}

export interface ObjectGenerationRequest<T> extends TextGenerationRequest {
  /** Validated against the raw response; a schema mismatch is a non-retryable `invalid_response`. */
  schema: z.ZodType<T>;
}

export interface AiProvider {
  readonly name: string;
  generateText(request: TextGenerationRequest): Promise<AiResult<string>>;
  generateObject<T>(request: ObjectGenerationRequest<T>): Promise<AiResult<T>>;
}
