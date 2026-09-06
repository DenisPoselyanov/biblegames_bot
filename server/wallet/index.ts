import type { ServerConfig } from '../config/env';
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

export function createWalletLedger(config: ServerConfig): WalletLedger {
  return config.storageProvider === 'sql' ? createSqlWalletLedger() : createJsonWalletLedger();
}
