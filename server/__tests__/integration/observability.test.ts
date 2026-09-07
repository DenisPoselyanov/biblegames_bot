import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../../config/env';
import { createApp } from '../../app';
import { createMemoryStore } from '../helpers/memoryStore';
import { createMemoryWalletLedger } from '../../wallet';

function makeApp(env: Record<string, string> = {}) {
  const { config } = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'development', ...env });
  return createApp({
    config,
    dbStore: createMemoryStore(),
    walletLedger: createMemoryWalletLedger(),
  });
}

describe('observability (§16)', () => {
  it('GET /health/live is always ok and unauthenticated', async () => {
    const res = await request(makeApp()).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('GET /health/ready reports storage readiness', async () => {
    const res = await request(makeApp()).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('GET /metrics returns a flat counter map with no secrets', async () => {
    const app = makeApp({ TELEGRAM_BOT_TOKEN: 'super-secret-token' });
    // drive one auth failure so a counter exists
    await request(app).get('/api/v1/me/profile'); // no identity → 401

    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('super-secret-token');
    expect(Object.keys(res.body).some((k) => k.startsWith('auth_failed_total'))).toBe(true);
  });

  it('every error response carries the request id and no stack', async () => {
    const res = await request(makeApp()).get('/api/v1/me/profile');
    expect(res.status).toBe(401);
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
    expect(JSON.stringify(res.body)).not.toMatch(/\.ts:\d+:\d+/);
  });
});

describe('demo route isolation (§10)', () => {
  it('mounts demo routes off-production', async () => {
    const res = await request(makeApp()).get('/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body.items).toBeInstanceOf(Array);
  });

  it('removes demo routes entirely under NODE_ENV=production', async () => {
    const { config } = loadConfig({
      NODE_ENV: 'production',
      AUTH_MODE: 'telegram',
      TELEGRAM_BOT_TOKEN: 'x',
      CLIENT_ORIGIN: 'https://app.example.com',
    });
    expect(config.demoRoutesEnabled).toBe(false);
    const app = createApp({ config, dbStore: createMemoryStore(), walletLedger: createMemoryWalletLedger() });
    for (const path of ['/leaderboard', '/dashboard', '/study/path']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(404);
    }
  });
});
