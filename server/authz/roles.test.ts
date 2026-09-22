import { describe, expect, it } from 'vitest';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
  normalizeRoles,
  permissionsForRoles,
} from './roles';

describe('role/permission taxonomy', () => {
  it('admin holds every permission', () => {
    expect(new Set(ROLE_PERMISSIONS.admin)).toEqual(new Set(PERMISSIONS));
  });

  it('questions:admin is admin-only (still true through Phase 4 WS5 — ADR-004, granted with the WS8 Studio cutover)', () => {
    const holders = ROLES.filter((role) => ROLE_PERMISSIONS[role].includes('questions:admin'));
    expect(holders).toEqual(['admin']);
  });

  it('a plain user has no permissions', () => {
    expect(ROLE_PERMISSIONS.user).toEqual([]);
    expect(permissionsForRoles(['user']).size).toBe(0);
  });

  it('content_publisher can review but not administer questions', () => {
    const perms = permissionsForRoles(['content_publisher']);
    expect(perms.has('content:publish')).toBe(true);
    expect(perms.has('questions:admin')).toBe(false);
  });

  it('content_reviewer can approve but not publish or roll back — separation of duties (spec §11)', () => {
    const perms = permissionsForRoles(['content_reviewer']);
    expect(perms.has('content:review')).toBe(true);
    expect(perms.has('content:approve')).toBe(true);
    expect(perms.has('content:publish')).toBe(false);
    expect(perms.has('content:rollback')).toBe(false);
  });

  it('content_publisher is a strict superset of content_reviewer, plus publish/rollback', () => {
    const reviewerPerms = permissionsForRoles(['content_reviewer']);
    const publisherPerms = permissionsForRoles(['content_publisher']);
    for (const perm of reviewerPerms) expect(publisherPerms.has(perm)).toBe(true);
    expect(publisherPerms.has('content:publish')).toBe(true);
    expect(publisherPerms.has('content:rollback')).toBe(true);
  });

  it('both content roles can run AI jobs and import, but neither can read the general audit log', () => {
    for (const role of ['content_reviewer', 'content_publisher'] as const) {
      const perms = permissionsForRoles([role]);
      expect(perms.has('content:ai:run')).toBe(true);
      expect(perms.has('content:import')).toBe(true);
      expect(perms.has('content:audit:read')).toBe(true);
      expect(perms.has('audit:read')).toBe(false);
    }
  });

  it('normalizeRoles always includes user and dedupes in canonical order', () => {
    expect(normalizeRoles(['admin', 'admin'])).toEqual(['user', 'admin']);
    expect(normalizeRoles([])).toEqual(['user']);
  });
});
