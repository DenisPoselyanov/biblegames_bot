import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  STUDIO_NAV_STORAGE_KEY,
  STUDIO_STORAGE_KEY,
  StudioContext,
  type StudioStore,
  type ThemePref,
} from './studioContext';
import { studioRepo } from '../../../repos/studioRepo';
import { useAuthSession } from '../../../context/AuthSessionContext';
import { queryKeys } from '../../../queries/keys';

function readThemePref(): ThemePref {
  try {
    const raw = window.localStorage.getItem(STUDIO_STORAGE_KEY);
    return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
  } catch {
    return 'system';
  }
}

function readNavCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STUDIO_NAV_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

function systemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/**
 * Identity (roles/permissions) comes from the server — `GET /api/v1/me` — and
 * is never client-chosen (unlike the design prototype this was ported from,
 * which let a viewer switch roles locally for a click-through demo). Only the
 * theme and the folded sidebar are genuine per-viewer, no-security-stake
 * choices, so only those are kept in `localStorage`.
 */
export function StudioStoreProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuthSession();
  const [themePref, setThemePrefState] = useState<ThemePref>(readThemePref);
  const [navCollapsed, setNavCollapsed] = useState<boolean>(readNavCollapsed);
  const [system, setSystem] = useState<'light' | 'dark'>(systemTheme);

  const identityQuery = useQuery({
    queryKey: queryKeys.studio.identity(userId),
    queryFn: () => studioRepo.getMyIdentity(),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STUDIO_STORAGE_KEY, themePref);
    } catch {
      /* private mode — the studio still works, it just forgets the preference. */
    }
  }, [themePref]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STUDIO_NAV_STORAGE_KEY, navCollapsed ? '1' : '0');
    } catch {
      /* same as above */
    }
  }, [navCollapsed]);

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = (e: MediaQueryListEvent) => setSystem(e.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const theme = themePref === 'system' ? system : themePref;

  const value = useMemo<StudioStore>(
    () => ({
      identity: identityQuery.data ?? null,
      identityStatus: identityQuery.isLoading ? 'loading' : identityQuery.isError ? 'error' : 'ready',
      themePref,
      setThemePref: setThemePrefState,
      theme,
      navCollapsed,
      setNavCollapsed,
    }),
    [
      identityQuery.data,
      identityQuery.isLoading,
      identityQuery.isError,
      themePref,
      theme,
      navCollapsed,
    ],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}
