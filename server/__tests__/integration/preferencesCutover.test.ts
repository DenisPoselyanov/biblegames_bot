import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../../config/env';
import { createApp } from '../../app';
import { createInMemoryIdentityRepositories } from '../../domains/identity/inMemoryRepository';
import { createMemoryStore } from '../helpers/memoryStore';
import { createMemoryWalletLedger } from '../../wallet';

function makeApp(env: Record<string, string> = {}) {
  const { config } = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'development', ...env });
  const identity = createInMemoryIdentityRepositories();
  const dbStore = createMemoryStore();
  const app = createApp({
    config,
    dbStore,
    walletLedger: createMemoryWalletLedger(),
    identity,
  });
  return { app, identity, dbStore };
}

const patchPrefs = (app: ReturnType<typeof makeApp>['app'], body: unknown) =>
  request(app).patch('/api/v1/me/preferences').set('x-user-id', '500').send(body);

describe('typed-preferences cutover (§18.2)', () => {
  it('dual-writes to the typed store and the blob by default', async () => {
    const { app, identity, dbStore } = makeApp();

    const res = await patchPrefs(app, { bibleTranslation: 'UTT' });
    expect(res.status).toBe(200);
    expect(res.body.bibleTranslation).toBe('UTT');

    expect((await identity.preferences.get('500'))?.bibleTranslation).toBe('UTT');
    expect((await dbStore.getProfile('500'))?.bibleTranslation).toBe('UTT');
  });

  it('with LEGACY_STORE_READONLY the blob preference fields stay frozen', async () => {
    const { app, identity, dbStore } = makeApp({ LEGACY_STORE_READONLY: 'true' });

    await patchPrefs(app, { bibleTranslation: 'UTT' });

    expect((await identity.preferences.get('500'))?.bibleTranslation).toBe('UTT');
    expect((await dbStore.getProfile('500'))?.bibleTranslation).toBeUndefined();
  });

  it('reads overlay the typed store on top of the blob', async () => {
    const { app, identity } = makeApp();
    await identity.preferences.upsert('500', { activeTheme: 'dawn' });

    const res = await request(app).get('/api/v1/me/profile').set('x-user-id', '500');
    expect(res.status).toBe(200);
    expect(res.body.activeTheme).toBe('dawn');
  });
});
