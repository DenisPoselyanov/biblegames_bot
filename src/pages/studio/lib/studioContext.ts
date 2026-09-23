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
}

export const STUDIO_STORAGE_KEY = 'studio-theme-v1';

export const StudioContext = createContext<StudioStore | null>(null);
