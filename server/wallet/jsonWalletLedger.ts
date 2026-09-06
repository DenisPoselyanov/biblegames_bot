import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { readJsonFile, withFileMutex, writeJsonFileAtomic } from '../db/atomicJson';
import {
  applyPost,
  clampWalletLimit,
  WalletError,
  type WalletEntry,
  type WalletLedger,
} from './walletLedger';

type PersistedWallet = Record<string, WalletEntry[]>;

/**
 * JSON wallet adapter for local/dev. All mutations run through `withFileMutex`
 * so a double-submit inside one process is serialized and the ledger's
 * (sourceType, sourceId) uniqueness holds.
 */
export function createJsonWalletLedger(filePath?: string): WalletLedger {
  const file = filePath ?? resolve(process.cwd(), '.data', 'wallet.json');

  const read = (): PersistedWallet => readJsonFile<PersistedWallet>(file, {});
  const entriesFor = (db: PersistedWallet, userId: string): WalletEntry[] => db[userId] ?? [];

  return {
    async getBalance(userId) {
      return entriesFor(read(), userId).reduce((sum, e) => sum + e.amount, 0);
    },

    async listEntries(userId, opts) {
      return entriesFor(read(), userId)
        .slice()
        .reverse()
        .slice(0, clampWalletLimit(opts?.limit));
    },

    async post(input) {
      return withFileMutex(file, async () => {
        const db = read();
        const result = applyPost(entriesFor(db, input.userId), input);
        if (!result.replayed) {
          db[input.userId] = [...entriesFor(db, input.userId), result.entry];
          writeJsonFileAtomic(file, db);
        }
        return result;
      });
    },

    async reverse(entryId, sourceId, metadata) {
      return withFileMutex(file, async () => {
        const db = read();
        const original = Object.values(db)
          .flat()
          .find((e) => e.id === entryId);
        if (!original) throw new WalletError('not_found', `No wallet entry ${entryId}`);

        const userEntries = entriesFor(db, original.userId);
        const result = applyPost(
          userEntries,
          {
            userId: original.userId,
            type: 'adjustment',
            amount: -original.amount,
            sourceType: 'reversal',
            sourceId,
            metadata,
          },
          () => new Date(),
          () => randomUUID(),
        );
        if (!result.replayed) {
          result.entry.type = 'reversal';
          result.entry.reversalOf = entryId;
          db[original.userId] = [...userEntries, result.entry];
          writeJsonFileAtomic(file, db);
        }
        return result;
      });
    },
  };
}
