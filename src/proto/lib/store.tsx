import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  INITIAL_STATE,
  ProtoContext,
  STORAGE_KEY,
  type ProtoState,
  type ProtoStore,
} from './protoContext';

/**
 * Local prototype state: a plain reducer over `useState` plus a localStorage
 * mirror. No server, no react-query, nothing the legacy app owns.
 */

function read(): ProtoState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;
    return { ...INITIAL_STATE, ...(JSON.parse(raw) as Partial<ProtoState>) };
  } catch {
    return INITIAL_STATE;
  }
}

export function ProtoStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProtoState>(read);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* private mode — the prototype still works, it just forgets. */
    }
  }, [state]);

  const patch = useCallback((next: Partial<ProtoState>) => {
    setState((prev) => ({ ...prev, ...next }));
  }, []);

  const value = useMemo<ProtoStore>(
    () => ({
      ...state,
      setTheme: (theme) => patch({ theme }),
      toggleTheme: () => patch({ theme: state.theme === 'dark' ? 'light' : 'dark' }),
      setLessonBlock: (lessonBlock) => patch({ lessonBlock }),
      completeLesson: () =>
        setState((prev) => ({
          ...prev,
          lessonDone: true,
          xp: prev.xp + 40,
          coins: prev.coins + 15,
        })),
      finishPractice: (result) =>
        setState((prev) => ({
          ...prev,
          lastResult: result,
          xp: prev.xp + result.xp,
          coins: prev.coins + result.coins,
          answeredToday: prev.answeredToday + result.total,
        })),
      reset: () => setState({ ...INITIAL_STATE, theme: state.theme }),
    }),
    [state, patch],
  );

  return <ProtoContext.Provider value={value}>{children}</ProtoContext.Provider>;
}
