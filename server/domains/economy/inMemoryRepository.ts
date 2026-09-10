/**
 * In-memory economy repositories (Phase 2 §10 parity peer).
 *
 * For dev fixtures and as the contract-test peer to the SQL adapter. Writes
 * inside a `tx` are rejected — the in-memory store does not emulate transactions
 * for production writes (§10).
 */
import { randomUUID } from 'node:crypto';
import type { Transaction } from '../shared/context';
import type { EconomyRepositories, EntitlementRepository } from './entitlements';
import type {
  EntitlementRecord,
  GrantEntitlementInput,
  RevokeEntitlementInput,
} from './types';

function rejectTx(tx?: Transaction): void {
  if (tx) {
    throw new Error('in-memory economy repository does not support transactional writes (§10)');
  }
}

/** Mirrors the `uq_entitlements_user_product_live` unique index violation. */
export class EntitlementConflictError extends Error {
  constructor(userId: string, productId: string) {
    super(`user ${userId} already holds a live entitlement for product ${productId}`);
    this.name = 'EntitlementConflictError';
  }
}

export function createInMemoryEconomyRepositories(
  now: () => Date = () => new Date(),
): EconomyRepositories {
  /** id -> row */
  const rows = new Map<string, EntitlementRecord>();
  const iso = (): string => now().toISOString();
  const sourceKey = (sourceType: string, sourceId: string): string => `${sourceType}\0${sourceId}`;

  const isEffective = (row: EntitlementRecord, at: Date): boolean =>
    row.status === 'active' &&
    row.revokedAt === null &&
    (row.expiresAt === null || Date.parse(row.expiresAt) > at.getTime());

  const entitlements: EntitlementRepository = {
    async list(userId, tx) {
      rejectTx(tx);
      return [...rows.values()]
        .filter((r) => r.userId === userId)
        .sort((a, b) => b.grantedAt.localeCompare(a.grantedAt))
        .map((r) => ({ ...r }));
    },

    async listActive(userId, at, tx) {
      rejectTx(tx);
      return [...rows.values()]
        .filter((r) => r.userId === userId && isEffective(r, at))
        .sort((a, b) => b.grantedAt.localeCompare(a.grantedAt))
        .map((r) => ({ ...r }));
    },

    async findBySource(sourceType, sourceId, tx) {
      rejectTx(tx);
      const key = sourceKey(sourceType, sourceId);
      const row = [...rows.values()].find((r) => sourceKey(r.sourceType, r.sourceId) === key);
      return row ? { ...row } : null;
    },

    async grant(input: GrantEntitlementInput, tx) {
      rejectTx(tx);
      const existing = await this.findBySource(input.sourceType, input.sourceId);
      if (existing) return existing;

      const at = now();
      const clash = [...rows.values()].some(
        (r) =>
          r.userId === input.userId &&
          r.productId === input.productId &&
          r.status !== 'revoked',
      );
      if (clash) throw new EntitlementConflictError(input.userId, input.productId);

      const row: EntitlementRecord = {
        id: randomUUID(),
        userId: input.userId,
        productId: input.productId,
        productKind: input.productKind,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        status: 'active',
        grantedBy: input.grantedBy ?? null,
        grantedAt: at.toISOString(),
        expiresAt: input.expiresAt ?? null,
        revokedAt: null,
        revokedBy: null,
        metadata: input.metadata ?? {},
      };
      rows.set(row.id, row);
      return { ...row };
    },

    async revoke(input: RevokeEntitlementInput, tx) {
      rejectTx(tx);
      const row = [...rows.values()].find(
        (r) => r.userId === input.userId && r.productId === input.productId && r.revokedAt === null,
      );
      if (!row) return null;
      const next: EntitlementRecord = {
        ...row,
        status: 'revoked',
        revokedAt: iso(),
        revokedBy: input.revokedBy,
      };
      rows.set(next.id, next);
      return { ...next };
    },
  };

  return { entitlements };
}
