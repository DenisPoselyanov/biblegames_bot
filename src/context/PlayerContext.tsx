import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import type { GlobalStats, PlayerProfile } from '../types';
import { loadGlobalStats } from '../lib/storage';
import { useAuthSession } from '../context/AuthSessionContext';
import { flushTelemetry, trackEvent } from '../lib/telemetry';
import { studyRepo } from '../repos/studyRepo';
import { useGlobalStatsStore } from '../stores/globalStatsStore';
import { usePlayerProfileSync } from '../queries/usePlayerProfile';
import {
  useGlobalStatsSync,
  useRefreshGlobalStats,
} from '../queries/useGlobalStats';
import { useResolvedProfile } from '../hooks/domain/useProfileWriter';
import { useProgression, type ProgressionActions } from '../hooks/domain/useProgression';
import { useEconomy, type EconomyActions } from '../hooks/domain/useEconomy';
import {
  useLearningInsights,
  type LearningInsights,
} from '../hooks/domain/useLearningInsights';

/**
 * Aggregate view kept for the pages that have not yet moved to the domain hooks
 * directly (WS4 part 5). New code should call `useProgression` / `useEconomy` /
 * `useLearningInsights` / `useResolvedProfile` — not this context.
 */
interface PlayerContextValue
  extends ProgressionActions,
    EconomyActions,
    LearningInsights {
  profile: PlayerProfile;
  globalStats: GlobalStats;
  refreshStats: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { userId, displayName } = useAuthSession();
  const storedGlobalStats = useGlobalStatsStore((s) => s.globalStats);

  const profile = useResolvedProfile();
  const globalStats = storedGlobalStats ?? loadGlobalStats();

  usePlayerProfileSync(userId, displayName);
  useGlobalStatsSync(userId);
  const refreshStats = useRefreshGlobalStats(userId);

  const progression = useProgression();
  const economy = useEconomy();
  const learning = useLearningInsights();

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

  const value = useMemo(
    () => ({
      profile,
      globalStats,
      refreshStats,
      ...progression,
      ...economy,
      ...learning,
    }),
    [profile, globalStats, refreshStats, progression, economy, learning],
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
