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

  it('questions:admin is admin-only in Phase 1', () => {
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

  it('normalizeRoles always includes user and dedupes in canonical order', () => {
    expect(normalizeRoles(['admin', 'admin'])).toEqual(['user', 'admin']);
    expect(normalizeRoles([])).toEqual(['user']);
  });
});
