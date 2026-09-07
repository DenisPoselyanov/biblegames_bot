import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WalletError } from './walletLedger';
import { createJsonWalletLedger } from './jsonWalletLedger';

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'wallet-'));
  file = join(dir, 'wallet.json');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const earn = (sourceId: string, amount = 10) => ({
  userId: 'u1' as const,
  type: 'earn' as const,
  amount,
  sourceType: 'progression.completion',
  sourceId,
});

describe('createJsonWalletLedger', () => {
  it('credits, debits and derives the balance from entries', async () => {
    const ledger = createJsonWalletLedger(file);
    await ledger.post(earn('r1', 30));
    await ledger.post({ ...earn('r2'), type: 'spend', amount: -12 });
    expect(await ledger.getBalance('u1')).toBe(18);
  });

  it('rejects a debit that would overdraw', async () => {
    const ledger = createJsonWalletLedger(file);
    await ledger.post(earn('r1', 5));
    await expect(
      ledger.post({ ...earn('r2'), type: 'spend', amount: -10 }),
    ).rejects.toBeInstanceOf(WalletError);
    expect(await ledger.getBalance('u1')).toBe(5);
  });

  it('is idempotent on (sourceType, sourceId)', async () => {
    const ledger = createJsonWalletLedger(file);
    const a = await ledger.post(earn('run-42', 25));
    const b = await ledger.post(earn('run-42', 25));
    expect(a.replayed).toBe(false);
    expect(b.replayed).toBe(true);
    expect(b.entry.id).toBe(a.entry.id);
    expect(await ledger.getBalance('u1')).toBe(25);
  });

  it('grants once under a concurrent double-submit', async () => {
    const ledger = createJsonWalletLedger(file);
    const results = await Promise.all([
      ledger.post(earn('same', 40)),
      ledger.post(earn('same', 40)),
      ledger.post(earn('same', 40)),
    ]);
    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
    expect(await ledger.getBalance('u1')).toBe(40);
  });

  it('reverses an entry and links it, idempotently', async () => {
    const ledger = createJsonWalletLedger(file);
    const { entry } = await ledger.post(earn('r1', 50));
    const r1 = await ledger.reverse(entry.id, `rev:${entry.id}`);
    const r2 = await ledger.reverse(entry.id, `rev:${entry.id}`);
    expect(r1.entry.type).toBe('reversal');
    expect(r1.entry.reversalOf).toBe(entry.id);
    expect(r2.replayed).toBe(true);
    expect(await ledger.getBalance('u1')).toBe(0);
  });
});
