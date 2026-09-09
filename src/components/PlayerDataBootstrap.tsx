import { useEffect, type ReactNode } from 'react';
import { useAuthSession } from '../context/AuthSessionContext';
import { flushTelemetry, trackEvent } from '../lib/telemetry';
import { studyRepo } from '../repos/studyRepo';
import { usePlayerProfileSync } from '../queries/usePlayerProfile';
import { useGlobalStatsSync } from '../queries/useGlobalStats';

/**
 * Mount point for the app's per-session data plumbing — the server→store sync
 * for profile and global stats, plus session telemetry. Mounted once near the
 * root. Replaces the old `PlayerProvider`, which is gone (WS4 part 5): pages now
 * read through the domain hooks (`useProgression` / `useEconomy` /
 * `useLearningInsights` / `useResolvedProfile`) and `useGlobalStats`, not a
 * single context value.
 */
export function PlayerDataBootstrap({ children }: { children: ReactNode }) {
  const { userId, displayName } = useAuthSession();

  usePlayerProfileSync(userId, displayName);
  useGlobalStatsSync(userId);

  useEffect(() => {
    void studyRepo.syncHistory();
    trackEvent('session_start', { userId });
    void flushTelemetry(userId);

    const timer = window.setInterval(() => {
      void flushTelemetry(userId);
    }, 15000);

    return () => {
      window.clearInterval(timer);
    };
  }, [userId]);

  return <>{children}</>;
}
