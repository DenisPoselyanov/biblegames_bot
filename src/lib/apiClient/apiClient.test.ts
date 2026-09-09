import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.stubEnv('VITE_API_BASE_URL', 'https://api.test');

let currentInitData = '';
vi.mock('../telegram', () => ({
  getTelegramInitData: () => currentInitData,
}));

const { apiRequest } = await import('./request');
const { ApiError, ApiNetworkError, parseApiError } = await import('./errors');
const { mayAutoRetry } = await import('./retry');
const { newRequestId } = await import('./requestId');

/** Await a promise expected to reject and hand back the (typed) rejection value. */
function rejection<E = InstanceType<typeof ApiError>>(p: Promise<unknown>): Promise<E> {
  return p.then(
    () => {
      throw new Error('expected promise to reject');
    },
    (e: unknown) => e as E,
  );
}

interface FetchCall {
  url: string;
  init: RequestInit;
}
let calls: FetchCall[] = [];

function stubFetch(handler: (call: FetchCall, attempt: number) => { status?: number; statusText?: string; jsonBody?: unknown }) {
  calls = [];
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    const call = { url, init };
    calls.push(call);
    const { status = 200, statusText = '', jsonBody } = handler(call, calls.length - 1);
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText,
      headers: new Headers(),
      json: () => Promise.resolve(jsonBody ?? {}),
    } as Response);
  });
}

beforeEach(() => {
  currentInitData = '';
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('newRequestId', () => {
  it('produces an id the server middleware would accept (/^[\\w-]{8,128}$/)', () => {
    for (let i = 0; i < 20; i++) {
      expect(newRequestId()).toMatch(/^[\w-]{8,128}$/);
    }
  });
});

describe('mayAutoRetry', () => {
  it('retries idempotent methods and keyed commands only', () => {
    expect(mayAutoRetry('GET', false)).toBe(true);
    expect(mayAutoRetry('HEAD', false)).toBe(true);
    expect(mayAutoRetry('POST', false)).toBe(false);
    expect(mayAutoRetry('POST', true)).toBe(true);
    expect(mayAutoRetry('patch', false)).toBe(false);
  });
});

describe('apiRequest', () => {
  it('attaches content-type, a request id and the telegram identity header', async () => {
    currentInitData = 'tg-init';
    stubFetch(() => ({ status: 200, jsonBody: { ok: true } }));
    await apiRequest('/me/profile');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    expect(headers['x-request-id']).toMatch(/^[\w-]{8,128}$/);
    expect(headers['x-telegram-init-data']).toBe('tg-init');
    expect(headers['x-user-id']).toBeUndefined();
    expect(calls[0].url).toBe('https://api.test/api/v1/me/profile');
  });

  it('falls back to x-user-id when there is no telegram init data', async () => {
    stubFetch(() => ({ status: 200, jsonBody: {} }));
    await apiRequest('/me/profile');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['x-user-id']).toBe('guest');
    expect(headers['x-telegram-init-data']).toBeUndefined();
  });

  it('sends the idempotency-key header for a keyed command', async () => {
    stubFetch(() => ({ status: 200, jsonBody: { ok: true } }));
    await apiRequest('/shop/purchases', { method: 'POST', body: { itemId: 'x' }, idempotencyKey: 'k1' });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['idempotency-key']).toBe('k1');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ itemId: 'x' });
  });

  it('validates the response against a schema and returns typed data', async () => {
    stubFetch(() => ({ status: 200, jsonBody: { n: 7 } }));
    const out = await apiRequest('/thing', { schema: z.object({ n: z.number() }) });
    expect(out).toEqual({ n: 7 });
  });

  it('throws invalid_response when the schema rejects and mode is throw (default)', async () => {
    stubFetch(() => ({ status: 200, jsonBody: { n: 'nope' } }));
    const err = await rejection(apiRequest('/thing', { schema: z.object({ n: z.number() }) }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('invalid_response');
  });

  it('warn mode returns the raw payload when the schema rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch(() => ({ status: 200, jsonBody: { n: 'nope' } }));
    const out = await apiRequest('/thing', {
      schema: z.object({ n: z.number() }),
      onInvalidResponse: 'warn',
    });
    expect(out).toEqual({ n: 'nope' });
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('parses the §7.5 error envelope into a typed ApiError', async () => {
    stubFetch(() => ({
      status: 403,
      jsonBody: { error: { code: 'forbidden_permission', message: 'no', messageKey: 'err.forbidden', retryable: false } },
    }));
    const err = await rejection(apiRequest('/admin/thing'));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('forbidden_permission');
    expect(err.messageKey).toBe('err.forbidden');
    expect(err.status).toBe(403);
    expect(err.retryable).toBe(false);
  });

  it('marks rate_limited as retryable even without an explicit flag', async () => {
    stubFetch(() => ({ status: 429, jsonBody: { error: { code: 'rate_limited', message: 'slow down' } } }));
    const err = await rejection(apiRequest('/thing', { retry: false }));
    expect(err.retryable).toBe(true);
  });

  it('retries a GET on a 500 then succeeds', async () => {
    stubFetch((_c, attempt) =>
      attempt === 0
        ? { status: 500, jsonBody: { error: { code: 'internal_error', message: 'boom' } } }
        : { status: 200, jsonBody: { ok: true } },
    );
    const out = await apiRequest('/thing', { retry: { baseDelayMs: 0 } });
    expect(out).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
  });

  it('never retries a keyless POST even on a 500', async () => {
    stubFetch(() => ({ status: 500, jsonBody: { error: { code: 'internal_error', message: 'boom' } } }));
    await apiRequest('/thing', { method: 'POST', body: {}, retry: { baseDelayMs: 0 } }).catch(() => {});
    expect(calls).toHaveLength(1);
  });

  it('retries a keyed POST on a 500', async () => {
    stubFetch((_c, attempt) =>
      attempt < 2
        ? { status: 500, jsonBody: { error: { code: 'internal_error', message: 'boom' } } }
        : { status: 200, jsonBody: { ok: true } },
    );
    const out = await apiRequest('/thing', {
      method: 'POST',
      body: {},
      idempotencyKey: 'k',
      retry: { baseDelayMs: 0 },
    });
    expect(out).toEqual({ ok: true });
    expect(calls).toHaveLength(3);
  });

  it('wraps a transport failure in ApiNetworkError', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    const err = await rejection<InstanceType<typeof ApiNetworkError>>(
      apiRequest('/thing', { retry: false }),
    );
    expect(err).toBeInstanceOf(ApiNetworkError);
    expect(err.retryable).toBe(true);
  });

  it('propagates an AbortError untouched', async () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    vi.stubGlobal('fetch', () => Promise.reject(abort));
    const err = await rejection<Error>(apiRequest('/thing', { retry: false }));
    expect(err).toBe(abort);
  });

  it('resolves configured nullStatuses to null', async () => {
    stubFetch(() => ({ status: 404 }));
    const out = await apiRequest('/thing', { nullStatuses: [404] });
    expect(out).toBeNull();
  });
});

describe('parseApiError', () => {
  it('falls back to a bare http_<status> code for a non-envelope body', async () => {
    const res = { status: 502, statusText: 'Bad Gateway', json: () => Promise.reject(new Error('x')) } as unknown as Response;
    const err = await parseApiError(res);
    expect(err.code).toBe('http_502');
    expect(err.retryable).toBe(true);
  });
});
