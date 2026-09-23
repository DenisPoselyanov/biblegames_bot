/**
 * Generic OpenAI-`/chat/completions`-shaped `AiProvider` adapter (Phase 4
 * §7.1). Groq and OpenRouter both speak this exact contract (Bearer token +
 * `POST {baseUrl}/chat/completions`), the same shape `scripts/lib/omniroute.mjs`
 * already used against a local gateway — this is that same client, generalized
 * and given classified errors, so adding either provider is a `baseUrl`/model
 * choice, not new adapter code (see `docs/AI_SETUP.md`).
 *
 * Not wired into `createAiProvider()`'s default selection yet — Gemini is the
 * chosen primary provider for now (owner decision, 2026-09-22). Exported so a
 * later choice of Groq/OpenRouter as a secondary/fallback provider is a config
 * change, not new code.
 */
import type { z } from 'zod';
import {
  AiProviderError,
  type AiProvider,
  type AiResult,
  type ObjectGenerationRequest,
  type TextGenerationRequest,
} from '../../domains/ai/types';

const DEFAULT_TIMEOUT_MS = 60_000;

export interface OpenAiCompatibleProviderOptions {
  /** Adapter identity for `AiResultMeta.provider`, e.g. `"groq"` or `"openrouter"`. */
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  idGen?: () => string;
}

interface ChatCompletionsResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

function classifyHttpError(status: number, message: string): AiProviderError {
  if (status === 429) {
    return new AiProviderError(`Rate limited: ${message}`, { kind: 'rate_limited', retryable: true });
  }
  if (status === 401 || status === 403) {
    return new AiProviderError(`Auth error: ${message}`, { kind: 'auth', retryable: false });
  }
  return new AiProviderError(`API error (${status}): ${message}`, {
    kind: 'unknown',
    retryable: status >= 500,
  });
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly name: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly idGen: () => string;
  private seq = 0;

  constructor(options: OpenAiCompatibleProviderOptions) {
    this.name = options.name;
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.idGen = options.idGen ?? (() => `${this.name}_${Date.now()}_${++this.seq}`);
  }

  private async call(
    request: TextGenerationRequest,
    jsonMode: boolean,
  ): Promise<{ text: string; meta: AiResult<string>['meta'] }> {
    const start = this.now().getTime();
    const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const body: Record<string, unknown> = {
      model: this.model,
      messages: [{ role: 'user', content: request.prompt }],
      stream: false,
      temperature: request.temperature ?? 0.7,
    };
    if (request.maxOutputTokens) body.max_tokens = request.maxOutputTokens;
    if (jsonMode) body.response_format = { type: 'json_object' };

    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new AiProviderError(`${this.name} timed out after ${timeoutMs}ms`, {
          kind: 'timeout',
          retryable: true,
        });
      }
      throw new AiProviderError(`${this.name} request failed: ${(err as Error).message}`, {
        kind: 'unknown',
        retryable: true,
      });
    } finally {
      clearTimeout(timer);
    }

    const raw = await res.text();
    let data: ChatCompletionsResponse;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new AiProviderError(`${this.name}: could not parse response (${res.status})`, {
        kind: 'invalid_response',
        retryable: false,
      });
    }
    if (!res.ok) {
      const errBody = data as unknown as { error?: { message?: string }; message?: string };
      const message = errBody.error?.message || errBody.message || raw.slice(0, 200) || res.statusText;
      throw classifyHttpError(res.status, message);
    }

    const choice = data.choices?.[0];
    const text = String(choice?.message?.content ?? '').trim();
    if (!text) {
      throw new AiProviderError(`${this.name}: empty chat/completions response`, {
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
        warnings: [],
        finishReason: choice?.finish_reason,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
      },
    };
  }

  async generateText(request: TextGenerationRequest): Promise<AiResult<string>> {
    const { text, meta } = await this.call(request, false);
    return { value: text, meta };
  }

  async generateObject<T>(request: ObjectGenerationRequest<T>): Promise<AiResult<T>> {
    const { text, meta } = await this.call(request, true);
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      throw new AiProviderError(`${this.name}: response was not valid JSON`, {
        kind: 'invalid_response',
        retryable: false,
      });
    }
    const result = (request.schema as z.ZodType<T>).safeParse(parsedJson);
    if (!result.success) {
      throw new AiProviderError(
        `${this.name}: response failed schema validation — ${result.error.message}`,
        { kind: 'invalid_response', retryable: false },
      );
    }
    return { value: result.data, meta };
  }
}

export function createOpenAiCompatibleProvider(
  options: OpenAiCompatibleProviderOptions,
): OpenAiCompatibleProvider {
  return new OpenAiCompatibleProvider(options);
}
