/**
 * Deterministic `AiProvider` for orchestration tests (Phase 4 §7.4).
 *
 * No network. A test configures a queue of scripted responses per call —
 * success, a thrown `AiProviderError`, or an intentionally invalid payload —
 * so job-runner behavior (retry, budget stop, cancellation, schema-parse
 * failure) can be asserted without a real provider.
 */
import type { AiProvider, AiResult, ObjectGenerationRequest } from '../../domains/ai/types';
import { AiProviderError } from '../../domains/ai/types';

export type MockScriptedResult<T = string> =
  | { text: T }
  | { throw: AiProviderError };

export interface MockProviderOptions {
  model?: string;
  now?: () => Date;
  idGen?: () => string;
}

export class MockAiProvider implements AiProvider {
  readonly name = 'mock';
  private readonly model: string;
  private readonly now: () => Date;
  private readonly idGen: () => string;
  private readonly script: MockScriptedResult<unknown>[] = [];
  private calls = 0;

  constructor(options: MockProviderOptions = {}) {
    this.model = options.model ?? 'mock-model';
    this.now = options.now ?? (() => new Date());
    this.idGen = options.idGen ?? (() => `mock_${++this.calls}`);
  }

  /** Queue the next N calls' outcomes, in order. Consumed FIFO. */
  enqueue(...results: MockScriptedResult<unknown>[]): void {
    this.script.push(...results);
  }

  private next(): MockScriptedResult<unknown> {
    const item = this.script.shift();
    if (!item) {
      throw new AiProviderError('MockAiProvider: no scripted response queued', {
        kind: 'unknown',
        retryable: false,
      });
    }
    return item;
  }

  async generateText(): Promise<AiResult<string>> {
    const start = this.now().getTime();
    const item = this.next();
    if ('throw' in item) throw item.throw;
    const text = String(item.text);
    return {
      value: text,
      meta: {
        provider: this.name,
        model: this.model,
        requestId: this.idGen(),
        attempt: 1,
        durationMs: Math.max(0, this.now().getTime() - start),
        warnings: [],
        finishReason: 'STOP',
      },
    };
  }

  async generateObject<T>(request: ObjectGenerationRequest<T>): Promise<AiResult<T>> {
    const start = this.now().getTime();
    const item = this.next();
    if ('throw' in item) throw item.throw;
    const parsed = request.schema.safeParse(item.text);
    if (!parsed.success) {
      throw new AiProviderError(`MockAiProvider: scripted response failed schema — ${parsed.error.message}`, {
        kind: 'invalid_response',
        retryable: false,
      });
    }
    return {
      value: parsed.data,
      meta: {
        provider: this.name,
        model: this.model,
        requestId: this.idGen(),
        attempt: 1,
        durationMs: Math.max(0, this.now().getTime() - start),
        warnings: [],
        finishReason: 'STOP',
      },
    };
  }
}

export function createMockAiProvider(options?: MockProviderOptions): MockAiProvider {
  return new MockAiProvider(options);
}
