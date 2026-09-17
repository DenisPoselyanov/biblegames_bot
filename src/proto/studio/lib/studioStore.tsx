import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  STUDIO_STORAGE_KEY,
  StudioContext,
  type StudioStore,
  type ThemePref,
} from './studioContext';
import type { Role } from './types';

interface Persisted {
  role: Role;
  env: 'staging' | 'production';
  themePref: ThemePref;
}

const INITIAL: Persisted = { role: 'admin', env: 'staging', themePref: 'system' };

function read(): Persisted {
  try {
    const raw = window.localStorage.getItem(STUDIO_STORAGE_KEY);
    if (!raw) return INITIAL;
    return { ...INITIAL, ...(JSON.parse(raw) as Partial<Persisted>) };
  } catch {
    return INITIAL;
  }
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

function systemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/**
 * The prototype keeps only what the viewer chose — role, environment, theme.
 * Content, jobs and releases stay read-only mocks: this is a design prototype,
 * not a second implementation to keep in sync.
 */
export function StudioStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(read);
  const [system, setSystem] = useState<'light' | 'dark'>(systemTheme);

  useEffect(() => {
    try {
      window.localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* private mode — the prototype still works, it just forgets. */
    }
  }, [state]);

  /* `system` means "keep following the OS", not "read it once at startup". */
  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = (e: MediaQueryListEvent) => setSystem(e.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const setRole = useCallback((role: Role) => setState((prev) => ({ ...prev, role })), []);
  const setEnv = useCallback(
    (env: 'staging' | 'production') => setState((prev) => ({ ...prev, env })),
    [],
  );
  const setThemePref = useCallback(
    (themePref: ThemePref) => setState((prev) => ({ ...prev, themePref })),
    [],
  );

  const theme = state.themePref === 'system' ? system : state.themePref;

  const value = useMemo<StudioStore>(
    () => ({
      role: state.role,
      env: state.env,
      themePref: state.themePref,
      theme,
      setRole,
      setEnv,
      setThemePref,
    }),
    [state.role, state.env, state.themePref, theme, setRole, setEnv, setThemePref],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}
