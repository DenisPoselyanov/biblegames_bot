import { createContext } from 'react';
import type { MyIdentity } from '../../../repos/studioRepo';

/** What the viewer picked. `system` follows the OS setting and keeps following it. */
export type ThemePref = 'system' | 'light' | 'dark';

export interface StudioStore {
  identity: MyIdentity | null;
  identityStatus: 'loading' | 'ready' | 'error';
  themePref: ThemePref;
  setThemePref: (pref: ThemePref) => void;
  /** `themePref` after resolving `system` against the OS. */
  theme: 'light' | 'dark';
  /** Desktop only: the sidebar is folded to an icon rail. Tablets always start
      on the rail and open the full menu as an overlay, so this is not read there. */
  navCollapsed: boolean;
  setNavCollapsed: (collapsed: boolean) => void;
}

export const STUDIO_STORAGE_KEY = 'studio-theme-v1';
export const STUDIO_NAV_STORAGE_KEY = 'studio-nav-collapsed-v1';

export const StudioContext = createContext<StudioStore | null>(null);
