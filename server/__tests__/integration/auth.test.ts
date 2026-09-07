import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../../config/env';
import { createApp } from '../../app';
import { createMemoryStore } from '../helpers/memoryStore';
import { signInitData, TEST_BOT_TOKEN } from '../helpers/telegramFixture';

function telegramApp() {
  const { config } = loadConfig({
    NODE_ENV: 'test',
    AUTH_MODE: 'telegram',
    TELEGRAM_BOT_TOKEN: TEST_BOT_TOKEN,
    CLIENT_ORIGIN: 'https://app.example.com',
  });
  return createApp({ config, dbStore: createMemoryStore() });
}

function devApp() {
  const { config } = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'development' });
  return createApp({ config, dbStore: createMemoryStore() });
}

describe('HTTP authentication (telegram mode)', () => {
  it('rejects a protected route when only x-user-id is supplied', async () => {
    const res = await request(telegramApp()).get('/api/v1/me/profile').set('x-user-id', '42');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBeDefined();
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\(.*:\d+:\d+\)/); // no stack
  });

  it('accepts a valid signed initData and reaches the route', async () => {
    const initData = signInitData({ botToken: TEST_BOT_TOKEN, user: { id: 42, first_name: 'Ada' } });
    const res = await request(telegramApp())
      .get('/api/v1/me/profile')
      .set('x-telegram-init-data', initData);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('42');
  });

  it('the self-scoped route only ever returns the caller\'s own data', async () => {
    const initData = signInitData({ botToken: TEST_BOT_TOKEN, user: { id: 42, first_name: 'Ada' } });
    // No `:userId` path param exists — cross-user access is structurally impossible.
    const res = await request(telegramApp())
      .get('/api/v1/me/profile')
      .set('x-user-id', '99') // ignored — identity is the verified principal
      .set('x-telegram-init-data', initData);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('42');
  });

  it('accepts initData via Authorization: tma <initData>', async () => {
    const initData = signInitData({ botToken: TEST_BOT_TOKEN, user: { id: 7, first_name: 'Grace' } });
    const res = await request(telegramApp())
      .get('/api/v1/me/profile')
      .set('authorization', `tma ${initData}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('7');
  });
});

describe('HTTP authentication (development mode)', () => {
  it('resolves a deterministic principal from x-user-id', async () => {
    const res = await request(devApp()).get('/api/v1/me/profile').set('x-user-id', '500');
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('500');
  });

  it('401s when no identity header is present', async () => {
    const res = await request(devApp()).get('/api/v1/me/profile');
    expect(res.status).toBe(401);
  });
});

describe('public routes remain open', () => {
  it('serves /health without auth', async () => {
    const res = await request(telegramApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
