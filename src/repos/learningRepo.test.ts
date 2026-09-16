import { afterEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('VITE_API_BASE_URL', 'https://api.test');

vi.mock('../lib/telegram', () => ({
  getTelegramInitData: () => '',
}));

const { learningRepo, LearningError } = await import('./learningRepo');

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
});

describe('learningRepo', () => {
  it('builds the search URL with q/testament/limit as query params', async () => {
    mockFetch(200, { items: [] });
    await learningRepo.search('Буття', { testament: 'old_testament', limit: 5 });
    expect(calls[0].url).toBe(
      'https://api.test/api/v1/learning/search?q=%D0%91%D1%83%D1%82%D1%82%D1%8F&testament=old_testament&limit=5',
    );
  });

  it('omits absent query params rather than sending them empty', async () => {
    mockFetch(200, { plans: [] });
    await learningRepo.listPlans();
    expect(calls[0].url).toBe('https://api.test/api/v1/learning/plans');
  });

  it('resolves null on a 404 for a get-by-id read instead of throwing', async () => {
    mockFetch(404, { error: { code: 'plan_not_found', message: 'nope' } });
    const plan = await learningRepo.getPlan('missing');
    expect(plan).toBeNull();
  });

  it('throws LearningError carrying the server error code on another non-2xx', async () => {
    mockFetch(400, { error: { code: 'invalid_query', message: 'too short' } });
    const err = await learningRepo.search('a').catch((e) => e);
    expect(err).toBeInstanceOf(LearningError);
    expect(err.code).toBe('invalid_query');
  });

  it('sends the lesson-session start as a POST with an idempotency key', async () => {
    mockFetch(200, {
      session: {
        id: 's1',
        lessonId: 'l1',
        status: 'in_progress',
        contentRevision: 'r1',
        checkpointBlockId: null,
        startedAt: '2026-01-01T00:00:00.000Z',
        lastActivityAt: '2026-01-01T00:00:00.000Z',
        completedAt: null,
      },
      lesson: { id: 'l1', planId: 'p1', moduleId: 'm1', objectiveId: 'o1', title: 'L', description: null, status: 'published', position: 0, blocks: [] },
    });
    await learningRepo.startLessonSession('l1', 'idem-1');
    expect(calls[0].url).toBe('https://api.test/api/v1/learning/lessons/l1/sessions');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['idempotency-key']).toBe('idem-1');
  });
});
