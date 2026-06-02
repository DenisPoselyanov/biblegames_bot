import { useCallback, useEffect, useRef } from 'react';
import { clearGameSession, saveGameSession } from '../lib/gameSession';

const SAVE_DEBOUNCE_MS = 200;

export function usePersistedRun<T>({
  sessionKey,
  snapshot,
  enabled = true,
}: {
  sessionKey: string;
  snapshot: T;
  enabled?: boolean;
}): { clear: () => void } {
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const clear = useCallback(() => {
    clearGameSession(sessionKey);
  }, [sessionKey]);

  useEffect(() => {
    if (!enabled) return;
    const timerId = window.setTimeout(() => {
      saveGameSession(sessionKey, snapshotRef.current);
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timerId);
  }, [sessionKey, snapshot, enabled]);

  return { clear };
}
