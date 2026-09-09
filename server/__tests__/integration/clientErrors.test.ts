import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../../config/env';
import { createApp } from '../../app';
import { metrics } from '../../lib/metrics';
import { createMemoryStore } from '../helpers/memoryStore';

const { config } = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'development' });
const app = () => createApp({ config, dbStore: createMemoryStore() });

afterEach(() => metrics.reset());

describe('POST /api/v1/client-errors (§20)', () => {
  it('accepts a well-formed report and counts it', async () => {
    const res = await request(app())
      .post('/api/v1/client-errors')
      .send({
        route: '/play/study',
        buildVersion: '1.2.3-abc',
        code: 'render_error',
        level: 'error',
        message: 'Cannot read properties of undefined',
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    const snap = metrics.snapshot();
    expect(Object.keys(snap).some((k) => k.startsWith('client_errors_total'))).toBe(true);
  });

  it('rejects an unknown key (strict contract)', async () => {
    const res = await request(app())
      .post('/api/v1/client-errors')
      .send({ route: '/x', buildVersion: '1', code: 'x', stack: 'secret/local/path.ts:1' });
    expect(res.status).toBe(400);
  });

  it('rejects a non-slug code', async () => {
    const res = await request(app())
      .post('/api/v1/client-errors')
      .send({ route: '/x', buildVersion: '1', code: 'Render Error!' });
    expect(res.status).toBe(400);
  });

  it('needs no authentication', async () => {
    const res = await request(app())
      .post('/api/v1/client-errors')
      .send({ route: '/', buildVersion: 'v', code: 'window_error' });
    expect(res.status).toBe(200);
  });
});
