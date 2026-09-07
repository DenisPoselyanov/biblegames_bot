import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../../config/env';
import { createApp } from '../../app';
import { createMemoryWalletLedger } from '../../wallet';
import { createMemoryIdempotencyStore } from '../../lib/idempotency';
import { createMemoryMigrationStore } from '../../migration/migrationStore';
import { createMemoryAuditLog, type AuditLog } from '../../audit';
import { createMemoryStore } from '../helpers/memoryStore';

function makeApp(env: Record<string, string> = {}) {
  const { config } = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'development', ...env });
  const walletLedger = createMemoryWalletLedger();
  const auditLog: AuditLog = createMemoryAuditLog();
  const app = createApp({
    config,
    dbStore: createMemoryStore(),
    walletLedger,
    idempotency: createMemoryIdempotencyStore(),
    migrationStore: createMemoryMigrationStore(),
    auditLog,
  });
  return { app, walletLedger, auditLog };
}

// gennesaret-sea costs 300 (src/data/cosmetics.ts).
const buyTheme = (overrides: Record<string, unknown> = {}) => ({
  kind: 'theme',
  itemId: 'gennesaret-sea',
  idempotencyKey: 'p1',
  ...overrides,
});

async function fund(app: ReturnType<typeof makeApp>['app'], amount: number) {
  // Earn coins through a survival completion (score == coins).
  await request(app)
    .post('/api/v1/progression/completions')
    .set('x-user-id', '7')
    .send({ kind: 'survival', runId: 'fund', idempotencyKey: 'fund', score: amount });
}

describe('POST /api/v1/shop/purchases', () => {
  it('debits the wallet, records ownership, sets active theme, and audits', async () => {
    const { app, walletLedger, auditLog } = makeApp();
    await fund(app, 500);

    const res = await request(app).post('/api/v1/shop/purchases').set('x-user-id', '7').send(buyTheme());
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(200);
    expect(res.body.unlockedThemes).toContain('gennesaret-sea');
    expect(res.body.activeTheme).toBe('gennesaret-sea');
    expect(res.body.achievementsGranted).toContain('aesthete');
    expect(await walletLedger.getBalance('7')).toBe(200);

    const profile = await request(app).get('/api/v1/me/profile').set('x-user-id', '7');
    expect(profile.body.unlockedThemes).toContain('gennesaret-sea');
    expect(profile.body.coins).toBe(200);

    const audit = await auditLog.query({ action: 'shop.purchase' });
    expect(audit).toHaveLength(1);
    expect(audit[0].metadata).toMatchObject({ kind: 'theme', price: 300 });
  });

  it('rejects insufficient funds and leaves no ownership', async () => {
    const { app, walletLedger } = makeApp();
    await fund(app, 100);

    const res = await request(app).post('/api/v1/shop/purchases').set('x-user-id', '7').send(buyTheme());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('insufficient_funds');
    expect(await walletLedger.getBalance('7')).toBe(100);

    const profile = await request(app).get('/api/v1/me/profile').set('x-user-id', '7');
    expect(profile.body.unlockedThemes ?? []).not.toContain('gennesaret-sea');
  });

  it('409s on a second purchase of an owned item', async () => {
    const { app } = makeApp();
    await fund(app, 1000);
    await request(app).post('/api/v1/shop/purchases').set('x-user-id', '7').send(buyTheme());
    const res = await request(app)
      .post('/api/v1/shop/purchases')
      .set('x-user-id', '7')
      .send(buyTheme({ idempotencyKey: 'p2' }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('already_owned');
  });

  it('400s on an unknown item', async () => {
    const { app } = makeApp();
    await fund(app, 1000);
    const res = await request(app)
      .post('/api/v1/shop/purchases')
      .set('x-user-id', '7')
      .send(buyTheme({ itemId: 'no-such-theme' }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('unknown_item');
  });

  it('replays an identical idempotencyKey without a second debit', async () => {
    const { app, walletLedger } = makeApp();
    await fund(app, 1000);
    const a = await request(app).post('/api/v1/shop/purchases').set('x-user-id', '7').send(buyTheme());
    const b = await request(app).post('/api/v1/shop/purchases').set('x-user-id', '7').send(buyTheme());
    expect(b.status).toBe(200);
    expect(b.body.balance).toBe(a.body.balance);
    expect(await walletLedger.getBalance('7')).toBe(700);
  });
});
