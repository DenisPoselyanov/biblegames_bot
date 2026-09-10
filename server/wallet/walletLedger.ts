/**
 * Immutable wallet ledger (Phase 1 §8, ADR-003).
 *
 * The balance is the sum of ledger entries — never a mutable integer. Entries
 * are append-only; a correction is a new `reversal` entry linked to the
 * original, never an edit. Each entry carries a `(sourceType, sourceId)` pair
 * that is unique across the ledger: posting the same pair twice returns the
 * original entry and mutates nothing (idempotent reward/purchase replay).
 */

import { randomUUID } from 'node:crypto';
import type { Transaction } from '../domains/shared/context';

export type WalletTxnType =
  | 'earn'
  | 'spend'
  | 'migration_opening'
  | 'adjustment'
  | 'reversal';

export interface WalletEntry {
  id: string;
  userId: string;
  type: WalletTxnType;
  /** Signed: positive credits, negative debits. */
  amount: number;
  /** Running balance immediately after this entry was applied. */
  balanceAfter: number;
  sourceType: string;
  sourceId: string;
  /** Set on `reversal` entries — the id of the entry being reversed. */
  reversalOf?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface WalletPostInput {
  userId: string;
  type: Exclude<WalletTxnType, 'reversal'>;
  amount: number;
  sourceType: string;
  sourceId: string;
  metadata?: Record<string, unknown>;
}

export interface WalletPostResult {
  entry: WalletEntry;
  /** true when an entry for this (sourceType, sourceId) already existed. */
  replayed: boolean;
}

export interface WalletListOptions {
  limit?: number;
}

export interface WalletLedger {
  /**
   * `tx` (SQL adapter only) reads the balance on the transaction's connection so
   * a reward computed inside `db.transaction` sees a consistent value. The
   * in-memory / JSON adapters ignore it.
   */
  getBalance(userId: string, tx?: Transaction): Promise<number>;
  listEntries(userId: string, opts?: WalletListOptions): Promise<WalletEntry[]>;
  /**
   * Idempotent on (sourceType, sourceId). Rejects a debit that would overdraw.
   * `tx` (SQL adapter only) runs the insert on that transaction's connection so
   * the ledger row commits or rolls back atomically with the caller's other
   * writes. The in-memory / JSON adapters ignore it.
   */
  post(input: WalletPostInput, tx?: Transaction): Promise<WalletPostResult>;
  /** Post a compensating entry for `entryId`. Idempotent on (`reversal`, sourceId). */
  reverse(entryId: string, sourceId: string, metadata?: Record<string, unknown>): Promise<WalletPostResult>;
}

export class WalletError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'WalletError';
    this.code = code;
  }
}

export const WALLET_LIST_DEFAULT_LIMIT = 100;
export const WALLET_LIST_MAX_LIMIT = 1000;

export function clampWalletLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit) || (limit ?? 0) <= 0) return WALLET_LIST_DEFAULT_LIMIT;
  return Math.min(Math.floor(limit as number), WALLET_LIST_MAX_LIMIT);
}

export function assertPostable(input: WalletPostInput): void {
  if (!Number.isFinite(input.amount) || !Number.isInteger(input.amount)) {
    throw new WalletError('invalid_amount', 'Wallet amount must be an integer');
  }
  if (input.amount === 0) {
    throw new WalletError('invalid_amount', 'Wallet amount must be non-zero');
  }
  if (!input.userId || !input.sourceType || !input.sourceId) {
    throw new WalletError('invalid_source', 'userId, sourceType and sourceId are required');
  }
}

/**
 * Pure application of one post against a user's existing entries. Shared by the
 * JSON adapter and the tests; the SQL adapter does the equivalent in one
 * statement.
 */
export function applyPost(
  existing: readonly WalletEntry[],
  input: WalletPostInput,
  now: () => Date = () => new Date(),
  makeId: () => string = () => randomUUID(),
): WalletPostResult {
  assertPostable(input);
  const prior = existing.find(
    (e) => e.sourceType === input.sourceType && e.sourceId === input.sourceId,
  );
  if (prior) return { entry: prior, replayed: true };

  const balance = existing.reduce((sum, e) => sum + e.amount, 0);
  const balanceAfter = balance + input.amount;
  if (balanceAfter < 0) {
    throw new WalletError('insufficient_funds', 'Wallet balance cannot go negative');
  }

  const entry: WalletEntry = {
    id: makeId(),
    userId: input.userId,
    type: input.type,
    amount: input.amount,
    balanceAfter,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    createdAt: now().toISOString(),
    metadata: input.metadata,
  };
  return { entry, replayed: false };
}

/** In-memory adapter for tests. */
export function createMemoryWalletLedger(): WalletLedger & { entries: WalletEntry[] } {
  const entries: WalletEntry[] = [];
  const forUser = (userId: string) => entries.filter((e) => e.userId === userId);

  const ledger: WalletLedger & { entries: WalletEntry[] } = {
    entries,
    async getBalance(userId) {
      return forUser(userId).reduce((sum, e) => sum + e.amount, 0);
    },
    async listEntries(userId, opts) {
      return forUser(userId)
        .slice()
        .reverse()
        .slice(0, clampWalletLimit(opts?.limit));
    },
    async post(input) {
      const result = applyPost(forUser(input.userId), input);
      if (!result.replayed) entries.push(result.entry);
      return result;
    },
    async reverse(entryId, sourceId, metadata) {
      const original = entries.find((e) => e.id === entryId);
      if (!original) throw new WalletError('not_found', `No wallet entry ${entryId}`);
      const result = applyPost(forUser(original.userId), {
        userId: original.userId,
        type: 'adjustment',
        amount: -original.amount,
        sourceType: 'reversal',
        sourceId,
        metadata,
      });
      if (!result.replayed) {
        result.entry.type = 'reversal';
        result.entry.reversalOf = entryId;
        entries.push(result.entry);
      }
      return result;
    },
  };
  return ledger;
}
