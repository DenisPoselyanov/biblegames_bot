import { describe, expect, it } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { createMemoryAuditLog } from '../audit';
import { AppError } from '../lib/errors';
import { RoleRegistry } from './roleRegistry';
import { createPolicies } from './policy';

function fakeReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'PUT',
    originalUrl: '/api/admin/questions/q1',
    id: 'req-1',
    ...overrides,
  } as Request;
}

function run(handler: (req: Request, res: Response, next: NextFunction) => void, req: Request) {
  return new Promise<{ error?: unknown }>((resolve) => {
    handler(req, {} as Response, (error?: unknown) => resolve({ error }));
  });
}

const registry = new RoleRegistry([
  { userId: 'admin-1', roles: ['admin'] },
  { userId: 'reviewer-1', roles: ['content_reviewer'] },
]);

describe('requirePermission', () => {
  it('passes an actor that holds the permission and records authz context', async () => {
    const auditLog = createMemoryAuditLog();
    const { requirePermission } = createPolicies({ roleRegistry: registry, auditLog });
    const req = fakeReq({ auth: { userId: 'admin-1', authSource: 'telegram' } as Request['auth'] });

    const { error } = await run(requirePermission('questions:admin'), req);

    expect(error).toBeUndefined();
    expect(req.authz?.matchedPermission).toBe('questions:admin');
    expect(auditLog.records).toHaveLength(0);
  });

  it('denies an actor without the permission and writes an authz.denied record', async () => {
    const auditLog = createMemoryAuditLog();
    const { requirePermission } = createPolicies({ roleRegistry: registry, auditLog });
    const req = fakeReq({
      auth: { userId: 'reviewer-1', authSource: 'telegram' } as Request['auth'],
    });

    const { error } = await run(requirePermission('questions:admin'), req);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('forbidden_permission');
    expect((error as AppError).httpStatus).toBe(403);
    expect(auditLog.records).toHaveLength(1);
    expect(auditLog.records[0]).toMatchObject({ action: 'authz.denied', result: 'denied' });
  });

  it('401s when there is no principal', async () => {
    const auditLog = createMemoryAuditLog();
    const { requirePermission } = createPolicies({ roleRegistry: registry, auditLog });

    const { error } = await run(requirePermission('questions:admin'), fakeReq());

    expect((error as AppError).httpStatus).toBe(401);
  });
});

describe('requireOwnResourceOrPermission', () => {
  const auditLog = createMemoryAuditLog();
  const { requireOwnResourceOrPermission } = createPolicies({ roleRegistry: registry, auditLog });
  const policy = requireOwnResourceOrPermission((req) => req.params.userId, 'users:manage');

  it('allows the owner', async () => {
    const req = fakeReq({
      params: { userId: 'reviewer-1' } as Request['params'],
      auth: { userId: 'reviewer-1', authSource: 'telegram' } as Request['auth'],
    });
    const { error } = await run(policy, req);
    expect(error).toBeUndefined();
  });

  it('blocks a non-owner without the permission', async () => {
    const req = fakeReq({
      params: { userId: 'someone-else' } as Request['params'],
      auth: { userId: 'reviewer-1', authSource: 'telegram' } as Request['auth'],
    });
    const { error } = await run(policy, req);
    expect((error as AppError).code).toBe('forbidden_user_scope');
  });

  it('lets staff with the permission through', async () => {
    const req = fakeReq({
      params: { userId: 'someone-else' } as Request['params'],
      auth: { userId: 'admin-1', authSource: 'telegram' } as Request['auth'],
    });
    const { error } = await run(policy, req);
    expect(error).toBeUndefined();
  });
});
