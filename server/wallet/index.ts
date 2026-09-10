import type { ServerConfig } from '../config/env';
import type { Transaction as DrizzleTx } from '../infrastructure/database/client';
import type { WalletLedger } from './walletLedger';
import { createJsonWalletLedger } from './jsonWalletLedger';
import { createSqlWalletLedger } from './sqlWalletLedger';

export type {
  WalletLedger,
  WalletEntry,
  WalletTxnType,
  WalletPostInput,
  WalletPostResult,
} from './walletLedger';
export { WalletError, createMemoryWalletLedger } from './walletLedger';
export { createSqlWalletLedger } from './sqlWalletLedger';

/**
 * `db` (optional) is the Drizzle handle over the shared pool — when given, the
 * SQL adapter runs its reads/writes on it and can join a caller's transaction
 * (ADR-016). Without it the adapter opens fresh pooled connections.
 */
export function createWalletLedger(
  config: ServerConfig,
  db?: Pick<DrizzleTx, 'execute'>,
): WalletLedger {
  return config.storageProvider === 'sql' ? createSqlWalletLedger(db) : createJsonWalletLedger();
}
