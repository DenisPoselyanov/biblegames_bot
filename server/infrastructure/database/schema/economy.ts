/**
 * Economy storage (Phase 2 §5.4, §9). Adopted 1:1 from `server/db/schema.sql`.
 */
import { bigint, index, pgTable, text, unique } from 'drizzle-orm/pg-core';
import { createdAt, metadataBag } from './_shared';

/**
 * Append-only wallet ledger (Phase 1 §8, ADR-003). `balance = sum(amount)`;
 * `(source_type, source_id)` is the idempotency guard for a crediting event.
 */
export const walletLedger = pgTable(
  'wallet_ledger',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    type: text('type').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    balanceAfter: bigint('balance_after', { mode: 'number' }).notNull(),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    reversalOf: text('reversal_of'),
    createdAt: createdAt(),
    metadata: metadataBag(),
  },
  (t) => [
    unique('wallet_ledger_source_type_source_id_key').on(t.sourceType, t.sourceId),
    index('idx_wallet_ledger_user_time').on(t.userId, t.createdAt.desc()),
  ],
);
