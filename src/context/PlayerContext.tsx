import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  CompletedLevel,
  Difficulty,
  GlobalStats,
  PlayerProfile,
} from '../types';
import { DIFFICULTY_POINTS } from '../types';
import { loadGlobalStats, loadProfile, recordGlobalPlay, saveProfile } from '../lib/storage';
import { useTelegram } from '../hooks/useTelegram';

interface PlayerContextValue {
  profile: PlayerProfile;
  globalStats: GlobalStats;
  completeLevel: (
    themeId: string,
    difficulty: Difficulty,
    correctCount: number,
    totalQuestions: number,
  ) => { points: number; alreadyCompleted: boolean };
  isLevelDone: (themeId: string, difficulty: Difficulty) => boolean;
  refreshStats: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { userId, displayName } = useTelegram();
  const [profile, setProfile] = useState<PlayerProfile>(() =>
    loadProfile(userId, displayName),
  );
  const [globalStats, setGlobalStats] = useState<GlobalStats>(loadGlobalStats);

  useEffect(() => {
    setProfile(loadProfile(userId, displayName));
  }, [userId, displayName]);

  const refreshStats = useCallback(() => {
    setGlobalStats(loadGlobalStats());
  }, []);

  const isLevelDone = useCallback(
    (themeId: string, difficulty: Difficulty) =>
      profile.completedLevels.some(
        (l) => l.themeId === themeId && l.difficulty === difficulty,
      ),
    [profile.completedLevels],
  );

  const completeLevel = useCallback(
    (
      themeId: string,
      difficulty: Difficulty,
      correctCount: number,
      totalQuestions: number,
    ) => {
      const alreadyCompleted = profile.completedLevels.some(
        (l) => l.themeId === themeId && l.difficulty === difficulty,
      );
      const basePoints = DIFFICULTY_POINTS[difficulty];
      const accuracy = correctCount / totalQuestions;
      const points = Math.round(basePoints * accuracy);

      const level: CompletedLevel = {
        themeId,
        difficulty,
        score: correctCount,
        maxScore: totalQuestions,
        completedAt: new Date().toISOString(),
      };

      const next: PlayerProfile = {
        ...profile,
        totalPoints: profile.totalPoints + points,
        themePoints: {
          ...profile.themePoints,
          [themeId]: (profile.themePoints[themeId] ?? 0) + points,
        },
        completedLevels: alreadyCompleted
          ? profile.completedLevels.map((l) =>
              l.themeId === themeId && l.difficulty === difficulty ? level : l,
            )
          : [...profile.completedLevels, level],
      };

      setProfile(next);
      saveProfile(next);

      const hadThemePoints = (profile.themePoints[themeId] ?? 0) > 0;
      const updated = recordGlobalPlay(themeId, points, !hadThemePoints);
      setGlobalStats(updated);

      return { points, alreadyCompleted };
    },
    [profile],
  );

  const value = useMemo(
    () => ({
      profile,
      globalStats,
      completeLevel,
      isLevelDone,
      refreshStats,
    }),
    [profile, globalStats, completeLevel, isLevelDone, refreshStats],
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
