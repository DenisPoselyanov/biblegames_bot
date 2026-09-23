/**
 * Client-side mirror of the server's Studio-relevant RBAC vocabulary
 * (`server/authz/roles.ts`). Kept in sync by hand — small, closed sets that
 * change only when a workstream adds a new permission.
 *
 * The server is the only real authority: every permission check here is UX
 * (hide a denied button, show a role label), never a security boundary. Every
 * Studio endpoint re-checks the permission itself (`requirePermission`,
 * fail-closed) regardless of what the client believes.
 */

export type Role = 'user' | 'group_leader' | 'content_reviewer' | 'content_publisher' | 'support' | 'admin';

export type Permission =
  | 'content:draft:create'
  | 'content:import'
  | 'content:ai:run'
  | 'content:review'
  | 'content:approve'
  | 'content:publish'
  | 'content:rollback'
  | 'content:audit:read'
  | 'users:manage'
  | 'groups:manage'
  | 'audit:read'
  | 'kahoot:host'
  | 'sessions:export'
  | 'questions:admin';

export const ROLE_LABEL: Record<Role, string> = {
  user: 'Гравець',
  group_leader: 'Лідер групи',
  content_reviewer: 'Рецензент контенту',
  content_publisher: 'Публікатор контенту',
  support: 'Підтримка',
  admin: 'Адміністратор',
};

/** True when a role holds any Studio-relevant permission at all. */
export function isStudioRole(roles: readonly string[]): boolean {
  return roles.some((r) => r === 'content_reviewer' || r === 'content_publisher' || r === 'admin');
}
