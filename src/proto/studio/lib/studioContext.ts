import { createContext } from 'react';
import type { Role } from './types';

/** What the viewer picked. `system` follows the OS setting and keeps following it. */
export type ThemePref = 'system' | 'light' | 'dark';

export interface StudioStore {
  /** Which role the prototype is being viewed as — drives every permission gate. */
  role: Role;
  setRole: (role: Role) => void;
  /** Environment the studio is pointed at. Publication is disabled off prod. */
  env: 'staging' | 'production';
  setEnv: (env: 'staging' | 'production') => void;
  themePref: ThemePref;
  setThemePref: (pref: ThemePref) => void;
  /** `themePref` after resolving `system` against the OS. */
  theme: 'light' | 'dark';
}

export const STUDIO_STORAGE_KEY = 'proto-studio-v1';

export const StudioContext = createContext<StudioStore | null>(null);
