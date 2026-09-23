import { useContext } from 'react';
import { StudioContext, type StudioStore } from './studioContext';
import type { Permission } from './rbac';

export function useStudio(): StudioStore {
  const store = useContext(StudioContext);
  if (!store) throw new Error('useStudio must be used inside StudioStoreProvider');
  return store;
}

/**
 * `can('content:publish')` against the server-reported permissions for the
 * signed-in principal. UX only — every Studio endpoint re-checks fail-closed
 * server-side regardless of what this returns (`rbac` glossary entry).
 */
export function useCan(): (permission: Permission) => boolean {
  const { identity } = useStudio();
  return (permission: Permission) => identity?.permissions.includes(permission) ?? false;
}
