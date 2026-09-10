/**
 * Economy storage (Phase 2 §5.4, §9).
 *
 * `wallet_ledger` was adopted 1:1 from `server/db/schema.sql`. `entitlements`
 * (§18.2, ADR-016) is the typed home for what used to be the `unlockedThemes` /
 * `unlockedAvatars` string arrays in the `player_profiles` blob — shaped on
 * Phase 6 §7.1 plus the `user_roles` grant/revoke provenance pattern.
 */
import { sql } from 'drizzle-orm';
import { bigint, index, pgTable, text, unique, uniqueIndex } from 'drizzle-orm/pg-core';
import { createdAt, metadataBag, tstz } from './_shared';
import { users } from './identity';

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

/**
 * A per-user grant of a product (a cosmetic theme or avatar today; Phase 6
 * extends `product_kind`). Replaces the `unlockedThemes` / `unlockedAvatars`
 * blob arrays. `(source_type, source_id)` is the idempotency guard — the grant
 * path writes blindly and relies on the conflict, exactly like `wallet_ledger`.
 * A revoked grant keeps its row (`status = 'revoked'`, `revoked_at` set) for
 * audit; `list_active` filters it out.
 */
export const entitlements = pgTable(
  'entitlements',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    productId: text('product_id').notNull(),
    /** `theme` | `avatar` (Phase 6 adds more). */
    productKind: text('product_kind').notNull().default('theme'),
    /** `purchase` | `grant` | `migration` | `promotion`. */
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    /** `active` | `expired` | `revoked`. */
    status: text('status').notNull().default('active'),
    grantedBy: text('granted_by'),
    grantedAt: createdAt(),
    expiresAt: tstz('expires_at'),
    revokedAt: tstz('revoked_at'),
    revokedBy: text('revoked_by'),
    metadata: metadataBag(),
  },
  (t) => [
    unique('uq_entitlements_source').on(t.sourceType, t.sourceId),
    uniqueIndex('uq_entitlements_user_product_live')
      .on(t.userId, t.productId)
      .where(sql`${t.status} <> 'revoked'`),
    index('idx_entitlements_user_active')
      .on(t.userId)
      .where(sql`${t.revokedAt} is null`),
  ],
);
