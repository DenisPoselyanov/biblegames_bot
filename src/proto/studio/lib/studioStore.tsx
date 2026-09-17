import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STUDIO_STORAGE_KEY, StudioContext, type StudioStore } from './studioContext';
import type { Role } from './types';

interface Persisted {
  role: Role;
  env: 'staging' | 'production';
}

const INITIAL: Persisted = { role: 'admin', env: 'staging' };

function read(): Persisted {
  try {
    const raw = window.localStorage.getItem(STUDIO_STORAGE_KEY);
    if (!raw) return INITIAL;
    return { ...INITIAL, ...(JSON.parse(raw) as Partial<Persisted>) };
  } catch {
    return INITIAL;
  }
}

/**
 * The prototype keeps only what the viewer chose — role and environment.
 * Content, jobs and releases stay read-only mocks: this is a design prototype,
 * not a second implementation to keep in sync.
 */
export function StudioStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(read);

  useEffect(() => {
    try {
      window.localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* private mode — the prototype still works, it just forgets. */
    }
  }, [state]);

  const setRole = useCallback((role: Role) => setState((prev) => ({ ...prev, role })), []);
  const setEnv = useCallback(
    (env: 'staging' | 'production') => setState((prev) => ({ ...prev, env })),
    [],
  );

  const value = useMemo<StudioStore>(
    () => ({ role: state.role, env: state.env, setRole, setEnv }),
    [state.role, state.env, setRole, setEnv],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}
