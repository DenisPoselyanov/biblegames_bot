import { afterEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('VITE_API_BASE_URL', 'https://api.test');

let currentInitData = '';
vi.mock('../lib/telegram', () => ({
  getTelegramInitData: () => currentInitData,
}));

const { progressionRepo, ProgressionError } = await import('./progressionRepo');

interface FetchCall {
  url: string;
  init: RequestInit;
}

let calls: FetchCall[] = [];

function mockFetch(status: number, body: unknown) {
  calls = [];
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText: 'x',
      json: () => Promise.resolve(body),
    } as Response);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  currentInitData = '';
});

describe('progressionRepo', () => {
  it('posts a completion command to /api/v1/progression/completions and returns the outcome', async () => {
    mockFetch(200, { eventId: 'e1', delta: { coins: 15 }, next: { coins: 15 } });
    const out = await progressionRepo.completion({
      kind: 'level',
      runId: 'r1',
      idempotencyKey: 'k1',
      difficulty: 'child',
      themeId: 'gospels',
      correctCount: 7,
      totalQuestions: 7,
    });
    expect(out.eventId).toBe('e1');
    expect(calls[0].url).toBe('https://api.test/api/v1/progression/completions');
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({ kind: 'level', themeId: 'gospels' });
  });

  it('sends x-telegram-init-data and no x-user-id when initData is present', async () => {
    currentInitData = 'tg-init-data';
    mockFetch(200, {});
    await progressionRepo.answer({ questionId: 'q', isCorrect: true, idempotencyKey: 'a1' });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['x-telegram-init-data']).toBe('tg-init-data');
    expect(headers['x-user-id']).toBeUndefined();
  });

  it('throws ProgressionError carrying the server error code on a non-2xx', async () => {
    mockFetch(409, { error: { code: 'insufficient_funds', message: 'nope' } });
    const err = await progressionRepo
      .purchase({ kind: 'theme', itemId: 'gennesaret-sea', idempotencyKey: 'p1' })
      .catch((e) => e);
    expect(err).toBeInstanceOf(ProgressionError);
    expect(err.code).toBe('insufficient_funds');
    expect(err.status).toBe(409);
  });
});
