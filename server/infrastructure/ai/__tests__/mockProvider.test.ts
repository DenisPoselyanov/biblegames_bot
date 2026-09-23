import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createMockAiProvider } from '../mockProvider';
import { AiProviderError } from '../../../domains/ai/types';

describe('MockAiProvider (§7.4)', () => {
  it('returns scripted text in order', async () => {
    const provider = createMockAiProvider();
    provider.enqueue({ text: 'first' }, { text: 'second' });

    const a = await provider.generateText({ prompt: 'p1', promptVersion: 'v1' });
    const b = await provider.generateText({ prompt: 'p2', promptVersion: 'v1' });

    expect(a.value).toBe('first');
    expect(b.value).toBe('second');
    expect(a.meta.provider).toBe('mock');
  });

  it('throws a scripted AiProviderError for orchestration/retry tests', async () => {
    const provider = createMockAiProvider();
    const err = new AiProviderError('rate limited', { kind: 'rate_limited', retryable: true });
    provider.enqueue({ throw: err });

    await expect(provider.generateText({ prompt: 'p', promptVersion: 'v1' })).rejects.toBe(err);
  });

  it('validates generateObject output against the schema and rejects a mismatch', async () => {
    const provider = createMockAiProvider();
    const schema = z.object({ question: z.string(), correctIndex: z.number() });
    provider.enqueue({ text: { question: 'Who?', correctIndex: 'not-a-number' } });

    await expect(
      provider.generateObject({ prompt: 'p', promptVersion: 'v1', schema }),
    ).rejects.toMatchObject({ kind: 'invalid_response', retryable: false });
  });

  it('accepts a valid generateObject response', async () => {
    const provider = createMockAiProvider();
    const schema = z.object({ question: z.string(), correctIndex: z.number() });
    provider.enqueue({ text: { question: 'Who?', correctIndex: 1 } });

    const result = await provider.generateObject({ prompt: 'p', promptVersion: 'v1', schema });
    expect(result.value).toEqual({ question: 'Who?', correctIndex: 1 });
  });

  it('throws when the script queue is empty (forces every test to be explicit)', async () => {
    const provider = createMockAiProvider();
    await expect(provider.generateText({ prompt: 'p', promptVersion: 'v1' })).rejects.toThrow(
      /no scripted response/i,
    );
  });
});
