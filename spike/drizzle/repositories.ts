/**
 * Repository interfaces + a Drizzle implementation — Phase 2 WS2 spike (§10, ADR-012).
 *
 * Shows:
 *  - the interface is domain-owned and infrastructure-free (no Drizzle types leak
 *    through the interface — only domain / `@contracts` types);
 *  - the `Transaction` handle from `server/domains/shared/context.ts` maps onto
 *    Drizzle's transaction callback param;
 *  - the SQL adapter and a JSON/in-memory adapter satisfy the SAME read contract
 *    (§10 "JSON adapters must pass the same read contracts").
 */

import { and, eq, isNull } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import type { Role } from '../../server/authz/roles';
import type { ProgressionSnapshot } from '../../contracts/index';
import { progressionSnapshot } from '../../contracts/index';
import { spikeSchema, userRoles, users } from './schema';

type Db = NodePgDatabase<typeof spikeSchema>;

/** Opaque tx handle — the real one lives in `server/domains/shared/context.ts`. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/* ----------------------------------------------------------------- interfaces */

export interface UserRecord {
  id: string;
  displayName: string | null;
  username: string | null;
  languageCode: string | null;
  roles: readonly Role[];
}

export interface UserRepository {
  getById(id: string, tx?: Tx): Promise<UserRecord | null>;
  getByExternalId(provider: string, externalId: string): Promise<UserRecord | null>;
  grantRole(userId: string, role: Role, grantedBy: string, tx: Tx): Promise<void>;
  revokeRole(userId: string, role: Role, tx: Tx): Promise<void>;
}

export interface ProgressionRepository {
  getSnapshot(userId: string, tx?: Tx): Promise<ProgressionSnapshot | null>;
  saveSnapshot(userId: string, snapshot: ProgressionSnapshot, tx: Tx): Promise<void>;
}

/* ------------------------------------------------------------- drizzle adapter */

export function createDrizzleUserRepository(pool: Pool): UserRepository {
  const db = drizzle(pool, { schema: spikeSchema });

  const rolesFor = async (exec: Db | Tx, userId: string): Promise<Role[]> => {
    const rows = await exec
      .select({ key: userRoles.roleKey })
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), isNull(userRoles.revokedAt)));
    return rows.map((r) => r.key);
  };

  return {
    async getById(id, tx) {
      const exec = tx ?? db;
      const [row] = await exec.select().from(users).where(eq(users.id, id)).limit(1);
      if (!row) return null;
      return {
        id: row.id,
        displayName: row.displayName,
        username: row.username,
        languageCode: row.languageCode,
        roles: await rolesFor(exec, row.id),
      };
    },

    async getByExternalId(provider, externalId) {
      const row = await db.query.externalIdentities.findFirst({
        where: (ei, { and: a, eq: e }) =>
          a(e(ei.provider, provider), e(ei.externalId, externalId)),
        with: { /* relations omitted in spike */ },
      });
      return row ? this.getById(row.userId) : null;
    },

    async grantRole(userId, role, grantedBy, tx) {
      await tx
        .insert(userRoles)
        .values({ userId, roleKey: role, grantedBy })
        .onConflictDoUpdate({
          target: [userRoles.userId, userRoles.roleKey],
          set: { revokedAt: null, grantedBy },
        });
    },

    async revokeRole(userId, role, tx) {
      await tx
        .update(userRoles)
        .set({ revokedAt: new Date().toISOString() })
        .where(and(eq(userRoles.userId, userId), eq(userRoles.roleKey, role)));
    },
  };
}

export function createDrizzleProgressionRepository(pool: Pool): ProgressionRepository {
  const db = drizzle(pool, { schema: spikeSchema });
  return {
    async getSnapshot(userId, tx) {
      const exec = tx ?? db;
      const [row] = await exec
        .select()
        .from(spikeSchema.progressionSnapshots)
        .where(eq(spikeSchema.progressionSnapshots.userId, userId))
        .limit(1);
      return row ? progressionSnapshot.parse(row.snapshot) : null;
    },
    async saveSnapshot(userId, snapshot, tx) {
      const validated = progressionSnapshot.parse(snapshot);
      await tx
        .insert(spikeSchema.progressionSnapshots)
        .values({ userId, snapshot: validated })
        .onConflictDoUpdate({
          target: spikeSchema.progressionSnapshots.userId,
          set: { snapshot: validated, updatedAt: new Date().toISOString() },
        });
    },
  };
}

/* --------------------------------------------------- in-memory adapter (dev) */

/** Satisfies the same READ contract — used by contract tests as the parity peer. */
export function createMemoryUserRepository(seed: UserRecord[] = []): UserRepository {
  const byId = new Map(seed.map((u) => [u.id, structuredClone(u)]));
  const notInTx = (): never => {
    throw new Error('in-memory adapter does not support production write transactions (§10)');
  };
  return {
    async getById(id) {
      return byId.get(id) ?? null;
    },
    async getByExternalId() {
      return null;
    },
    grantRole: notInTx,
    revokeRole: notInTx,
  };
}

/**
 * How a service opens a transaction (the shape WS2 lands in the service layer):
 *
 *   await db.transaction(async (tx) => {
 *     await users.grantRole(userId, 'support', actorId, tx);
 *     await audit.record({ action: 'role.grant', ... }, tx);
 *   });
 *
 * `tx` is passed as `ServiceContext.tx`; a repo that receives no `tx` runs on the
 * pooled connection (autocommit) for reads.
 */
export type { Db };
