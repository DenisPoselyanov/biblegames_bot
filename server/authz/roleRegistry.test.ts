import { describe, expect, it } from 'vitest';
import { RoleRegistry, parseRoleGrants } from './roleRegistry';

describe('parseRoleGrants', () => {
  it('parses the JSON object form', () => {
    const warnings: string[] = [];
    const grants = parseRoleGrants(
      { RBAC_ROLE_GRANTS: '{"42":["admin"],"7":["content_reviewer"]}' },
      warnings,
    );
    expect(Object.fromEntries(grants.map((g) => [g.userId, g.roles]))).toEqual({
      '42': ['admin'],
      '7': ['content_reviewer'],
    });
    expect(warnings).toEqual([]);
  });

  it('parses the array form', () => {
    const grants = parseRoleGrants({
      RBAC_ROLE_GRANTS: '[{"userId":"9","roles":["support","group_leader"]}]',
    });
    expect(grants).toEqual([{ userId: '9', roles: ['support', 'group_leader'] }]);
  });

  it('merges RBAC_ADMIN_IDS as the admin role', () => {
    const grants = parseRoleGrants({
      RBAC_ROLE_GRANTS: '{"42":["support"]}',
      RBAC_ADMIN_IDS: '42, 99',
    });
    const byUser = Object.fromEntries(grants.map((g) => [g.userId, g.roles.sort()]));
    expect(byUser['42']).toEqual(['admin', 'support']);
    expect(byUser['99']).toEqual(['admin']);
  });

  it('drops unknown role names with a warning', () => {
    const warnings: string[] = [];
    const grants = parseRoleGrants({ RBAC_ROLE_GRANTS: '{"1":["superuser","admin"]}' }, warnings);
    expect(grants).toEqual([{ userId: '1', roles: ['admin'] }]);
    expect(warnings.join(' ')).toMatch(/unknown role "superuser"/);
  });

  it('treats malformed JSON as no grants, with a warning (fail-safe)', () => {
    const warnings: string[] = [];
    const grants = parseRoleGrants({ RBAC_ROLE_GRANTS: '{not json' }, warnings);
    expect(grants).toEqual([]);
    expect(warnings.join(' ')).toMatch(/not valid JSON/);
  });
});

describe('RoleRegistry', () => {
  const registry = new RoleRegistry([
    { userId: '42', roles: ['admin'] },
    { userId: '7', roles: ['content_reviewer'] },
  ]);

  it('returns [user] for an unknown user', () => {
    expect(registry.rolesFor('999')).toEqual(['user']);
    expect(registry.describe('999')).toEqual({ roles: ['user'], permissions: [] });
  });

  it('resolves permissions through granted roles', () => {
    expect(registry.hasPermission('42', 'questions:admin')).toBe(true);
    expect(registry.hasPermission('7', 'content:review')).toBe(true);
    expect(registry.hasPermission('7', 'questions:admin')).toBe(false);
  });

  it('includes the implicit user role in describe()', () => {
    expect(registry.describe('7').roles).toEqual(['user', 'content_reviewer']);
  });
});
