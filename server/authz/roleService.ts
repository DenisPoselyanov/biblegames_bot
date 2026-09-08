/**
 * Runtime RBAC grant/revoke service (Phase 2 WS2 part 3 — closes ADR-011).
 *
 * The one place role mutations happen at runtime. It writes through the
 * `RoleRepository` (provenance + `revoked_at` kept for audit), appends an audit
 * record for every change, and invalidates the `RoleResolver` cache so the new
 * state is visible on the caller's next request **on this instance** — other
 * instances converge within the resolver's TTL (see `./roleResolver.ts`).
 *
 * Lives in `server/authz/` (composition), not `server/domains/` — it depends on
 * the audit log and the resolver, which are not domain concerns.
 */

import { AppError } from '../lib/errors';
import type { AuditLog } from '../audit';
import { buildAuditRecord } from '../audit';
import type { RoleRepository, UserRepository } from '../domains/identity/repository';
import type { RoleGrantRecord } from '../domains/identity/types';
import type { Role } from './roles';
import type { RoleResolver } from './roleResolver';

export interface RoleServiceDeps {
  roleRepo: RoleRepository;
  userRepo: UserRepository;
  auditLog: AuditLog;
  resolver: RoleResolver;
}

export interface RoleMutation {
  /** Verified principal performing the change. */
  actor: string;
  /** Target user. */
  userId: string;
  role: Role;
  requestId?: string;
}

export interface UserRolesView {
  userId: string;
  roles: Role[];
  history: RoleGrantRecord[];
}

export interface RoleService {
  list(userId: string): Promise<UserRolesView>;
  grant(input: RoleMutation): Promise<RoleGrantRecord>;
  revoke(input: RoleMutation): Promise<RoleGrantRecord | null>;
}

export function createRoleService({
  roleRepo,
  userRepo,
  auditLog,
  resolver,
}: RoleServiceDeps): RoleService {
  const requireUser = async (userId: string): Promise<void> => {
    if (!(await userRepo.getById(userId))) {
      throw new AppError(
        'user_not_found',
        'No such user — the target must have signed in at least once',
        404,
      );
    }
  };

  const audit = (
    input: RoleMutation,
    action: 'rbac.role_granted' | 'rbac.role_revoked',
    outcome: 'changed' | 'noop',
  ): Promise<void> =>
    auditLog.append(
      buildAuditRecord({
        actor: { userId: input.actor, authSource: null },
        action,
        target: input.userId,
        result: 'ok',
        requestId: input.requestId,
        metadata: { role: input.role, outcome },
      }),
    );

  return {
    async list(userId) {
      const [roles, history] = await Promise.all([
        roleRepo.activeRoles(userId),
        roleRepo.history(userId),
      ]);
      return { userId, roles, history };
    },

    async grant(input) {
      await requireUser(input.userId);
      const before = await roleRepo.activeRoles(input.userId);
      const row = await roleRepo.grant({
        userId: input.userId,
        role: input.role,
        grantedBy: input.actor,
      });
      const changed = !before.includes(input.role);
      await audit(input, 'rbac.role_granted', changed ? 'changed' : 'noop');
      if (changed) resolver.invalidate(input.userId);
      return row;
    },

    async revoke(input) {
      if (input.userId === input.actor && input.role === 'admin') {
        throw new AppError(
          'cannot_revoke_own_admin',
          'An admin cannot revoke their own admin role',
          409,
        );
      }
      await requireUser(input.userId);
      const row = await roleRepo.revoke({
        userId: input.userId,
        role: input.role,
        revokedBy: input.actor,
      });
      await audit(input, 'rbac.role_revoked', row ? 'changed' : 'noop');
      if (row) resolver.invalidate(input.userId);
      return row;
    },
  };
}
