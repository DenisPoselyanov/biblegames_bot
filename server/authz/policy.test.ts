import { describe, expect, it } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { createMemoryAuditLog } from '../audit';
import { AppError } from '../lib/errors';
import { permissionsForRoles, type Permission, type Role } from './roles';
import { createPolicies } from './policy';

/**
 * Policies read the resolved `req.authz` that `attachPrincipalRoles` populates —
 * they no longer touch a store. These tests stamp `authz` directly.
 */
function fakeReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'PUT',
    originalUrl: '/api/admin/questions/q1',
    id: 'req-1',
    ...overrides,
  } as Request;
}

function withRoles(userId: string, roles: Role[], params: Record<string, string> = {}): Request {
  return fakeReq({
    auth: { userId, authSource: 'telegram' } as Request['auth'],
    authz: { roles, permissions: [...permissionsForRoles(roles)] as Permission[] },
    params: params as Request['params'],
  });
}

function run(handler: (req: Request, res: Response, next: NextFunction) => void, req: Request) {
  return new Promise<{ error?: unknown }>((resolve) => {
    handler(req, {} as Response, (error?: unknown) => resolve({ error }));
  });
}

describe('requirePermission', () => {
  it('passes an actor that holds the permission and records authz context', async () => {
    const auditLog = createMemoryAuditLog();
    const { requirePermission } = createPolicies({ auditLog });
    const req = withRoles('admin-1', ['admin']);

    const { error } = await run(requirePermission('questions:admin'), req);

    expect(error).toBeUndefined();
    expect(req.authz?.matchedPermission).toBe('questions:admin');
    expect(auditLog.records).toHaveLength(0);
  });

  it('denies an actor without the permission and writes an authz.denied record', async () => {
    const auditLog = createMemoryAuditLog();
    const { requirePermission } = createPolicies({ auditLog });
    const req = withRoles('reviewer-1', ['content_reviewer']);

    const { error } = await run(requirePermission('questions:admin'), req);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('forbidden_permission');
    expect((error as AppError).httpStatus).toBe(403);
    expect(auditLog.records).toHaveLength(1);
    expect(auditLog.records[0]).toMatchObject({ action: 'authz.denied', result: 'denied' });
  });

  it('401s when there is no principal', async () => {
    const auditLog = createMemoryAuditLog();
    const { requirePermission } = createPolicies({ auditLog });

    const { error } = await run(requirePermission('questions:admin'), fakeReq());

    expect((error as AppError).httpStatus).toBe(401);
  });

  it('denies a principal whose roles were never resolved (fail-safe)', async () => {
    const auditLog = createMemoryAuditLog();
    const { requirePermission } = createPolicies({ auditLog });
    const req = fakeReq({ auth: { userId: 'x', authSource: 'telegram' } as Request['auth'] });

    const { error } = await run(requirePermission('questions:admin'), req);

    expect((error as AppError).code).toBe('forbidden_permission');
  });
});

describe('requireRole', () => {
  it('passes only when the role is held', async () => {
    const auditLog = createMemoryAuditLog();
    const { requireRole } = createPolicies({ auditLog });

    expect((await run(requireRole('admin'), withRoles('a', ['admin']))).error).toBeUndefined();

    const denied = await run(requireRole('admin'), withRoles('b', ['support']));
    expect((denied.error as AppError).code).toBe('forbidden_role');
  });
});

describe('requireOwnResourceOrPermission', () => {
  const auditLog = createMemoryAuditLog();
  const { requireOwnResourceOrPermission } = createPolicies({ auditLog });
  const policy = requireOwnResourceOrPermission((req) => req.params.userId, 'users:manage');

  it('allows the owner', async () => {
    const { error } = await run(policy, withRoles('reviewer-1', ['content_reviewer'], { userId: 'reviewer-1' }));
    expect(error).toBeUndefined();
  });

  it('blocks a non-owner without the permission', async () => {
    const { error } = await run(policy, withRoles('reviewer-1', ['content_reviewer'], { userId: 'someone-else' }));
    expect((error as AppError).code).toBe('forbidden_user_scope');
  });

  it('lets staff with the permission through', async () => {
    const { error } = await run(policy, withRoles('admin-1', ['admin'], { userId: 'someone-else' }));
    expect(error).toBeUndefined();
  });
});
