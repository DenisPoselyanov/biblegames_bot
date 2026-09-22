import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createGeminiProvider } from '../geminiProvider';

function fakeResponse(status: number, body: unknown, ok = status >= 200 && status < 300): Response {
  return {
    ok,
    status,
    statusText: 'status',
    text: async () => JSON.stringify(body),
  } as Response;
}

function textCandidate(text: string, finishReason = 'STOP') {
  return { candidates: [{ content: { parts: [{ text }] }, finishReason }] };
}

describe('GeminiProvider (Phase 4 §7.1)', () => {
  it('generateText returns the joined candidate text', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(200, textCandidate('Hello')));
    const provider = createGeminiProvider({ apiKey: 'k', model: 'gemini-3.1-flash-lite', fetchImpl });

    const result = await provider.generateText({ prompt: 'hi', promptVersion: 'v1' });

    expect(result.value).toBe('Hello');
    expect(result.meta.provider).toBe('gemini');
    expect(result.meta.model).toBe('gemini-3.1-flash-lite');
  });

  it('generateObject parses and validates JSON against the schema', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(fakeResponse(200, textCandidate(JSON.stringify({ ok: true }))));
    const provider = createGeminiProvider({ apiKey: 'k', model: 'gemini-3.1-flash-lite', fetchImpl });

    const result = await provider.generateObject({
      prompt: 'hi',
      promptVersion: 'v1',
      schema: z.object({ ok: z.boolean() }),
    });

    expect(result.value).toEqual({ ok: true });
  });

  it('generateObject rejects a schema mismatch as a non-retryable invalid_response', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(fakeResponse(200, textCandidate(JSON.stringify({ ok: 'not-a-bool' }))));
    const provider = createGeminiProvider({ apiKey: 'k', model: 'gemini-3.1-flash-lite', fetchImpl });

    await expect(
      provider.generateObject({ prompt: 'hi', promptVersion: 'v1', schema: z.object({ ok: z.boolean() }) }),
    ).rejects.toMatchObject({ kind: 'invalid_response', retryable: false });
  });

  it('classifies a 429 as retryable rate_limited with a parsed retry delay', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      fakeResponse(429, { error: { message: 'Please retry in 2s' } }, false),
    );
    const provider = createGeminiProvider({ apiKey: 'k', model: 'gemini-3.1-flash-lite', fetchImpl });

    await expect(provider.generateText({ prompt: 'hi', promptVersion: 'v1' })).rejects.toMatchObject({
      kind: 'rate_limited',
      retryable: true,
      retryAfterMs: 2500,
    });
  });

  it('classifies a 401 as non-retryable auth', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(fakeResponse(401, { error: { message: 'bad key' } }, false));
    const provider = createGeminiProvider({ apiKey: 'k', model: 'gemini-3.1-flash-lite', fetchImpl });

    await expect(provider.generateText({ prompt: 'hi', promptVersion: 'v1' })).rejects.toMatchObject({
      kind: 'auth',
      retryable: false,
    });
  });

  it('treats a truncated response (non-STOP finishReason) as invalid_response', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(fakeResponse(200, { candidates: [{ content: { parts: [] }, finishReason: 'SAFETY' }] }));
    const provider = createGeminiProvider({ apiKey: 'k', model: 'gemini-3.1-flash-lite', fetchImpl });

    await expect(provider.generateText({ prompt: 'hi', promptVersion: 'v1' })).rejects.toMatchObject({
      kind: 'invalid_response',
      retryable: false,
    });
  });
});
