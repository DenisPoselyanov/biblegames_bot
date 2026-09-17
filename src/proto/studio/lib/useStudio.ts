import { useContext } from 'react';
import { StudioContext, type StudioStore } from './studioContext';
import { can as roleCan } from './mock';
import type { Permission } from './types';

export function useStudio(): StudioStore {
  const store = useContext(StudioContext);
  if (!store) throw new Error('useStudio must be used inside StudioStoreProvider');
  return store;
}

/** `can('content.publish')` for the role currently being previewed. */
export function useCan(): (permission: Permission) => boolean {
  const { role } = useStudio();
  return (permission: Permission) => roleCan(role, permission);
}
