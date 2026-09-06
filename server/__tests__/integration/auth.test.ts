import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../../config/env';
import { createApp } from '../../app';
import { createMemoryStore } from '../helpers/memoryStore';
import { signInitData, TEST_BOT_TOKEN } from '../helpers/telegramFixture';

afterEach(() => {
  delete process.env.FEATURE_AUTHV2;
});

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

describe('HTTP authentication (authV2, telegram mode)', () => {
  it('rejects a protected route when only x-user-id is supplied', async () => {
    const res = await request(telegramApp()).get('/profile/42').set('x-user-id', '42');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBeDefined();
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\(.*:\d+:\d+\)/); // no stack
  });

  it('accepts a valid signed initData and reaches the route', async () => {
    const initData = signInitData({ botToken: TEST_BOT_TOKEN, user: { id: 42, first_name: 'Ada' } });
    const res = await request(telegramApp())
      .get('/profile/42')
      .set('x-user-id', '42')
      .set('x-telegram-init-data', initData);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('42');
  });

  it('rejects cross-user access even with a valid principal', async () => {
    const initData = signInitData({ botToken: TEST_BOT_TOKEN, user: { id: 42, first_name: 'Ada' } });
    const res = await request(telegramApp())
      .get('/profile/99')
      .set('x-telegram-init-data', initData);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden_user_scope');
  });

  it('accepts initData via Authorization: tma <initData>', async () => {
    const initData = signInitData({ botToken: TEST_BOT_TOKEN, user: { id: 7, first_name: 'Grace' } });
    const res = await request(telegramApp()).get('/profile/7').set('authorization', `tma ${initData}`);
    expect(res.status).toBe(200);
  });

  it('FEATURE_AUTHV2=false reverts to the legacy middleware', async () => {
    process.env.FEATURE_AUTHV2 = 'false';
    // Legacy middleware needs x-user-id and (non-prod) allows missing initData.
    const res = await request(telegramApp()).get('/profile/42').set('x-user-id', '42');
    expect(res.status).toBe(200);
  });
});

describe('HTTP authentication (development mode)', () => {
  it('resolves a deterministic principal from x-user-id', async () => {
    const res = await request(devApp()).get('/profile/500').set('x-user-id', '500');
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('500');
  });

  it('still rejects cross-user access', async () => {
    const res = await request(devApp()).get('/profile/501').set('x-user-id', '500');
    expect(res.status).toBe(403);
  });

  it('401s when no identity header is present', async () => {
    const res = await request(devApp()).get('/profile/500');
    expect(res.status).toBe(401);
  });
});

describe('public + demo routes remain open', () => {
  it('serves /health without auth', async () => {
    const res = await request(telegramApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
