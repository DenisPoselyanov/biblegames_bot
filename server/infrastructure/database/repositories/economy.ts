/**
 * SQL economy repositories (Phase 2 §10, ADR-016) — the production adapter for
 * `server/domains/economy/entitlements.ts`, on Drizzle.
 *
 * The opaque `Transaction` from `ServiceContext` is narrowed to the Drizzle
 * executor here and nowhere else (`asExecutor`).
 */
import { randomUUID } from 'node:crypto';
import { and, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import type { Transaction as OpaqueTx } from '../../../domains/shared/context';
import type {
  EconomyRepositories,
  EntitlementRepository,
} from '../../../domains/economy/entitlements';
import type {
  EntitlementRecord,
  GrantEntitlementInput,
  RevokeEntitlementInput,
} from '../../../domains/economy/types';
import type { Database, Transaction } from '../client';
import { entitlements } from '../schema/economy';

type Executor = Database | Transaction;

/** Single point where the opaque handle becomes a concrete Drizzle executor. */
function asExecutor(db: Database, tx?: OpaqueTx): Executor {
  return (tx as unknown as Transaction | undefined) ?? db;
}

const toRecord = (r: typeof entitlements.$inferSelect): EntitlementRecord => ({
  id: r.id,
  userId: r.userId,
  productId: r.productId,
  productKind: r.productKind as EntitlementRecord['productKind'],
  sourceType: r.sourceType as EntitlementRecord['sourceType'],
  sourceId: r.sourceId,
  status: r.status as EntitlementRecord['status'],
  grantedBy: r.grantedBy,
  grantedAt: r.grantedAt,
  expiresAt: r.expiresAt,
  revokedAt: r.revokedAt,
  revokedBy: r.revokedBy,
  metadata: r.metadata,
});

export function createSqlEconomyRepositories(db: Database): EconomyRepositories {
  const entitlementsRepo: EntitlementRepository = {
    async list(userId, tx) {
      const rows = await asExecutor(db, tx)
        .select()
        .from(entitlements)
        .where(eq(entitlements.userId, userId))
        .orderBy(desc(entitlements.grantedAt));
      return rows.map(toRecord);
    },

    async listActive(userId, now, tx) {
      const rows = await asExecutor(db, tx)
        .select()
        .from(entitlements)
        .where(
          and(
            eq(entitlements.userId, userId),
            eq(entitlements.status, 'active'),
            isNull(entitlements.revokedAt),
            or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, now.toISOString())),
          ),
        )
        .orderBy(desc(entitlements.grantedAt));
      return rows.map(toRecord);
    },

    async findBySource(sourceType, sourceId, tx) {
      const [row] = await asExecutor(db, tx)
        .select()
        .from(entitlements)
        .where(
          and(eq(entitlements.sourceType, sourceType), eq(entitlements.sourceId, sourceId)),
        )
        .limit(1);
      return row ? toRecord(row) : null;
    },

    async grant(input: GrantEntitlementInput, tx) {
      const exec = asExecutor(db, tx);
      const [row] = await exec
        .insert(entitlements)
        .values({
          id: randomUUID(),
          userId: input.userId,
          productId: input.productId,
          productKind: input.productKind,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          grantedBy: input.grantedBy ?? null,
          expiresAt: input.expiresAt ?? null,
          metadata: input.metadata ?? {},
        })
        // Replay of the same crediting event: return the existing row untouched.
        // A *different* event that would create a second live grant for the same
        // (user, product) still raises `uq_entitlements_user_product_live`.
        .onConflictDoNothing({ target: [entitlements.sourceType, entitlements.sourceId] })
        .returning();
      if (row) return toRecord(row);

      const existing = await this.findBySource(input.sourceType, input.sourceId, tx);
      if (existing) return existing;
      throw new Error('entitlement grant did not insert and no prior row was found');
    },

    async revoke(input: RevokeEntitlementInput, tx) {
      const [row] = await asExecutor(db, tx)
        .update(entitlements)
        .set({
          status: 'revoked',
          revokedAt: sql`now()`,
          revokedBy: input.revokedBy,
        })
        .where(
          and(
            eq(entitlements.userId, input.userId),
            eq(entitlements.productId, input.productId),
            isNull(entitlements.revokedAt),
          ),
        )
        .returning();
      return row ? toRecord(row) : null;
    },
  };

  return { entitlements: entitlementsRepo };
}
