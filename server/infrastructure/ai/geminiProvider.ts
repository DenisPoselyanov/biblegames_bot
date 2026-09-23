/**
 * Gemini `AiProvider` adapter (Phase 4 §7.1). Network lives here, not in
 * `server/domains/ai` — mirrors `scripts/lib/gemini.mjs`'s request shape
 * (same endpoint, same `generationConfig.responseMimeType` trick for JSON),
 * but reports failures as classified `AiProviderError`s instead of sleeping
 * and retrying internally — the calling job handler's own `JobQueue`
 * backoff (`server/domains/jobs/inMemoryQueue.ts`) owns retry timing (§8.2).
 */
import type { z } from 'zod';
import {
  AiProviderError,
  type AiProvider,
  type AiResult,
  type ObjectGenerationRequest,
  type TextGenerationRequest,
} from '../../domains/ai/types';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_TIMEOUT_MS = 60_000;

export interface GeminiProviderOptions {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  idGen?: () => string;
}

/** "Please retry in 2.295570785s" → ms. */
function parseRetryDelayMs(message: string, fallbackMs = 5000): number {
  const secMatch = message.match(/retry(?: in| after)?\s+(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?/i);
  if (secMatch) return Math.ceil(parseFloat(secMatch[1]) * 1000) + 500;
  const msMatch = message.match(/retry(?: in| after)?\s+(\d+(?:\.\d+)?)\s*ms/i);
  if (msMatch) return Math.ceil(parseFloat(msMatch[1])) + 500;
  return fallbackMs;
}

function isRateLimitMessage(status: number, message: string): boolean {
  if (status === 429) return true;
  const text = message.toLowerCase();
  return (
    text.includes('quota') ||
    text.includes('rate limit') ||
    text.includes('rate-limit') ||
    text.includes('resource exhausted') ||
    text.includes('too many requests')
  );
}

function classifyHttpError(status: number, message: string): AiProviderError {
  if (isRateLimitMessage(status, message)) {
    return new AiProviderError(`Gemini rate limited: ${message}`, {
      kind: 'rate_limited',
      retryable: true,
      retryAfterMs: parseRetryDelayMs(message),
    });
  }
  if (status === 401 || status === 403) {
    return new AiProviderError(`Gemini auth error: ${message}`, { kind: 'auth', retryable: false });
  }
  return new AiProviderError(`Gemini API error (${status}): ${message}`, {
    kind: 'unknown',
    retryable: status >= 500,
  });
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly idGen: () => string;
  private seq = 0;

  constructor(options: GeminiProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.idGen = options.idGen ?? (() => `gemini_${Date.now()}_${++this.seq}`);
  }

  private async call(
    request: TextGenerationRequest,
    responseMimeType?: 'application/json',
  ): Promise<{ text: string; meta: Omit<AiResult<string>['meta'], 'warnings'> & { warnings: string[] } }> {
    const start = this.now().getTime();
    const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const generationConfig: Record<string, unknown> = {
      temperature: request.temperature ?? 0.7,
    };
    if (request.maxOutputTokens) generationConfig.maxOutputTokens = request.maxOutputTokens;
    if (responseMimeType) generationConfig.responseMimeType = responseMimeType;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
          generationConfig,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new AiProviderError(`Gemini timed out after ${timeoutMs}ms`, {
          kind: 'timeout',
          retryable: true,
        });
      }
      throw new AiProviderError(`Gemini request failed: ${(err as Error).message}`, {
        kind: 'unknown',
        retryable: true,
      });
    } finally {
      clearTimeout(timer);
    }

    const raw = await res.text();
    let data: GeminiResponse;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new AiProviderError(`Gemini: could not parse response (${res.status})`, {
        kind: 'invalid_response',
        retryable: false,
      });
    }
    if (!res.ok) {
      const errBody = data as unknown as { error?: { message?: string } };
      const message = errBody.error?.message || raw.slice(0, 200) || res.statusText;
      throw classifyHttpError(res.status, message);
    }

    const candidate = data.candidates?.[0];
    const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
    const warnings: string[] = [];
    if (!text) {
      const reason = candidate?.finishReason;
      if (reason && reason !== 'STOP') {
        throw new AiProviderError(`Gemini response truncated (${reason})`, {
          kind: 'invalid_response',
          retryable: false,
        });
      }
      throw new AiProviderError('Gemini returned an empty response', {
        kind: 'invalid_response',
        retryable: false,
      });
    }

    return {
      text,
      meta: {
        provider: this.name,
        model: this.model,
        requestId: this.idGen(),
        attempt: 1,
        durationMs: Math.max(0, this.now().getTime() - start),
        warnings,
        finishReason: candidate?.finishReason,
        usage: data.usageMetadata
          ? {
              promptTokens: data.usageMetadata.promptTokenCount,
              completionTokens: data.usageMetadata.candidatesTokenCount,
              totalTokens: data.usageMetadata.totalTokenCount,
            }
          : undefined,
      },
    };
  }

  async generateText(request: TextGenerationRequest): Promise<AiResult<string>> {
    const { text, meta } = await this.call(request);
    return { value: text, meta };
  }

  async generateObject<T>(request: ObjectGenerationRequest<T>): Promise<AiResult<T>> {
    const { text, meta } = await this.call(request, 'application/json');
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      throw new AiProviderError('Gemini: response was not valid JSON', {
        kind: 'invalid_response',
        retryable: false,
      });
    }
    const result = (request.schema as z.ZodType<T>).safeParse(parsedJson);
    if (!result.success) {
      throw new AiProviderError(`Gemini: response failed schema validation — ${result.error.message}`, {
        kind: 'invalid_response',
        retryable: false,
      });
    }
    return { value: result.data, meta };
  }
}

export function createGeminiProvider(options: GeminiProviderOptions): GeminiProvider {
  return new GeminiProvider(options);
}
