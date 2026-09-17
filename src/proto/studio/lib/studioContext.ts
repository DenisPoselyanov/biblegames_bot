import { createContext } from 'react';
import type { Role } from './types';

export interface StudioStore {
  /** Which role the prototype is being viewed as — drives every permission gate. */
  role: Role;
  setRole: (role: Role) => void;
  /** Environment the studio is pointed at. Publication is disabled off prod. */
  env: 'staging' | 'production';
  setEnv: (env: 'staging' | 'production') => void;
}

export const STUDIO_STORAGE_KEY = 'proto-studio-v1';

export const StudioContext = createContext<StudioStore | null>(null);
