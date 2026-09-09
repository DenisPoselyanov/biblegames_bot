import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The module reads `import.meta.env.VITE_API_BASE_URL` at import time.
vi.stubEnv('VITE_API_BASE_URL', 'https://api.test');

describe('reportClientError', () => {
  let beacon: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    beacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    vi.stubGlobal('window', { location: { pathname: '/play/study/quiz/genesis/youth' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts a minimal, sanitised report', async () => {
    const { reportClientError } = await import('./errorReporter');
    reportClientError({ code: 'Render Error!', message: 'x'.repeat(500) });

    expect(beacon).toHaveBeenCalledOnce();
    const [url, blob] = beacon.mock.calls[0];
    expect(url).toBe('https://api.test/api/v1/client-errors');
    const payload = JSON.parse(await (blob as Blob).text());
    expect(payload.route).toBe('/play/study/quiz/genesis/youth');
    expect(payload.code).toBe('render_error_');
    expect(payload.level).toBe('error');
    expect(payload.message).toHaveLength(300);
    expect(payload.buildVersion).toBe('0.0.0-test');
  });

  it('de-duplicates within the window and caps per load', async () => {
    const { reportClientError } = await import('./errorReporter');
    for (let i = 0; i < 5; i++) reportClientError({ code: 'window_error', message: 'same' });
    expect(beacon).toHaveBeenCalledOnce();

    for (let i = 0; i < 20; i++) reportClientError({ code: `code_${i}` });
    expect(beacon.mock.calls.length).toBeLessThanOrEqual(10);
  });

  it('is a no-op without an API base', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.resetModules();
    const { reportClientError } = await import('./errorReporter');
    reportClientError({ code: 'window_error' });
    expect(beacon).not.toHaveBeenCalled();
  });
});
