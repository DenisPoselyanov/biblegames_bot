import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../../config/env';
import { createApp } from '../../app';
import { createInMemoryIdentityRepositories } from '../../domains/identity/inMemoryRepository';
import { createMemoryIdempotencyStore } from '../../lib/idempotency';
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
    idempotency: createMemoryIdempotencyStore(),
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

  it('a shop purchase updates the typed store so the overlay stays consistent', async () => {
    const { app, identity } = makeApp();
    // stale typed value that would otherwise mask the purchase
    await identity.preferences.upsert('500', { activeTheme: 'dawn' });

    // fund via a survival completion (score == coins)
    await request(app)
      .post('/api/v1/progression/completions')
      .set('x-user-id', '500')
      .send({ kind: 'survival', runId: 'f', idempotencyKey: 'f', score: 500 });

    const buy = await request(app)
      .post('/api/v1/shop/purchases')
      .set('x-user-id', '500')
      .send({ kind: 'theme', itemId: 'gennesaret-sea', idempotencyKey: 'p1' });
    expect(buy.status).toBe(200);
    expect(buy.body.activeTheme).toBe('gennesaret-sea');

    expect((await identity.preferences.get('500'))?.activeTheme).toBe('gennesaret-sea');

    const profile = await request(app).get('/api/v1/me/profile').set('x-user-id', '500');
    expect(profile.body.activeTheme).toBe('gennesaret-sea');
  });
});
