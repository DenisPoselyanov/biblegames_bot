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
import { loadGlobalStats, loadProfile } from '../lib/storage';
import { useTelegram } from '../hooks/useTelegram';
import { getAchievementById } from '../data/achievements';
import { getCosmeticThemeById } from '../data/cosmetics';
import { STUDY_THEME_GROUPS } from '../data/study_themes';
import { updateMastery, updateStreak } from '../lib/learning';
import { flushTelemetry, trackEvent } from '../lib/telemetry';
import { studyRepo } from '../repos/studyRepo';
import { playerRepo } from '../repos/playerRepo';
import { statsRepo } from '../repos/statsRepo';

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
  saveSurvivalRun: (score: number, pointsEarned: number) => void;
  saveMillionaireRun: (reachedLevel: number, pointsEarned: number) => void;
  unlockAchievement: (achievementId: string) => boolean;
  purchaseTheme: (themeId: string) => { purchased: boolean; reason?: 'missing' | 'owned' | 'points' };
  setActiveTheme: (themeId: string) => boolean;
  refreshStats: () => void;
  setAvatar: (avatarId: string) => boolean;
  purchaseAvatar: (avatarId: string, price: number) => { purchased: boolean; reason?: 'owned' | 'coins' };
  recordAnswerEvent: (params: { themeId: string; isCorrect: boolean; questionId: string; errorTag?: string }) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { userId, displayName } = useTelegram();
  const [profile, setProfile] = useState<PlayerProfile>(() =>
    loadProfile(userId, displayName),
  );
  const [globalStats, setGlobalStats] = useState<GlobalStats>(loadGlobalStats);

  useEffect(() => {
    void playerRepo.get(userId, displayName).then(setProfile);
    void statsRepo.get(userId).then(setGlobalStats);
    void studyRepo.syncHistory(userId);
    trackEvent('session_start', { userId });
    void flushTelemetry(userId);

    const timer = window.setInterval(() => {
      void flushTelemetry(userId);
    }, 15000);

    return () => window.clearInterval(timer);
  }, [userId, displayName]);

  // Глобальне застосування активної косметичної теми
  useEffect(() => {
    const theme = getCosmeticThemeById(profile.activeTheme);
    if (!theme) return;

    const root = document.documentElement;
    root.style.setProperty('--bg', theme.preview.background);
    root.style.setProperty('--surface', theme.preview.surface);
    root.style.setProperty('--gold', theme.preview.primary);
    root.style.setProperty('--gold-light', theme.preview.accent);
    root.style.setProperty('--text', theme.preview.text);

    // Встановлення відповідної рамки та приглушеного тексту в залежності від теми
    if (theme.id === 'heavenly-jerusalem') {
      root.style.setProperty('--border', 'rgba(0, 0, 0, 0.08)');
      root.style.setProperty('--text-muted', 'rgba(0, 0, 0, 0.55)');
    } else {
      root.style.setProperty('--border', 'rgba(255, 255, 255, 0.08)');
      root.style.setProperty('--text-muted', 'rgba(255, 255, 255, 0.55)');
    }
  }, [profile.activeTheme]);

  const refreshStats = useCallback(() => {
    void statsRepo.get(userId).then(setGlobalStats);
  }, [userId]);

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

      // Перевірка та автоматичне розблокування досягнень
      const updatedAchievements = [...profile.achievements];
      if (correctCount === totalQuestions && !updatedAchievements.includes('flawless-level')) {
        updatedAchievements.push('flawless-level');
      }
      if (
        themeId === 'geography' &&
        difficulty === 'expert' &&
        correctCount === totalQuestions &&
        !updatedAchievements.includes('cartographer')
      ) {
        updatedAchievements.push('cartographer');
      }

      const next: PlayerProfile = {
        ...updateStreak(profile),
        totalPoints: profile.totalPoints + points,
        coins: profile.coins + points,
        themePoints: {
          ...profile.themePoints,
          [themeId]: (profile.themePoints[themeId] ?? 0) + points,
        },
        completedLevels: alreadyCompleted
          ? profile.completedLevels.map((l) =>
              l.themeId === themeId && l.difficulty === difficulty ? level : l,
            )
          : [...profile.completedLevels, level],
        achievements: updatedAchievements,
      };

      setProfile(next);
      void playerRepo.save(next);
      trackEvent('quiz_completed', { themeId, difficulty, points, correctCount, totalQuestions });

      const hadThemePoints = (profile.themePoints[themeId] ?? 0) > 0;
      void statsRepo.recordPlay(themeId, points, !hadThemePoints, userId).then(setGlobalStats);

      return { points, alreadyCompleted };
    },
    [profile],
  );

  const updateProfile = useCallback((updater: (current: PlayerProfile) => PlayerProfile) => {
    setProfile((current) => {
      const next = updater(current);
      void playerRepo.save(next);
      return next;
    });
  }, []);

  const saveSurvivalRun = useCallback(
    (score: number, pointsEarned: number) => {
      updateProfile((current) => ({
        ...current,
        totalPoints: current.totalPoints + pointsEarned,
        coins: current.coins + pointsEarned,
        survivalHighScore: Math.max(current.survivalHighScore, score),
      }));
    },
    [updateProfile],
  );

  const saveMillionaireRun = useCallback(
    (reachedLevel: number, pointsEarned: number) => {
      updateProfile((current) => ({
        ...current,
        totalPoints: current.totalPoints + pointsEarned,
        coins: current.coins + pointsEarned,
        millionaireWins:
          reachedLevel >= 15 ? current.millionaireWins + 1 : current.millionaireWins,
        millionaireMaxLevel: Math.max(current.millionaireMaxLevel, reachedLevel),
      }));
    },
    [updateProfile],
  );

  const unlockAchievement = useCallback(
    (achievementId: string) => {
      if (!getAchievementById(achievementId)) return false;
      if (profile.achievements.includes(achievementId)) return false;

      updateProfile((current) =>
        current.achievements.includes(achievementId)
          ? current
          : { ...current, achievements: [...current.achievements, achievementId] },
      );
      return true;
    },
    [profile.achievements, updateProfile],
  );

  const purchaseTheme = useCallback(
    (themeId: string) => {
      const theme = getCosmeticThemeById(themeId);
      if (!theme) return { purchased: false, reason: 'missing' as const };
      if (profile.unlockedThemes.includes(themeId)) {
        return { purchased: false, reason: 'owned' as const };
      }
      if (profile.totalPoints < theme.price) {
        return { purchased: false, reason: 'points' as const };
      }

      updateProfile((current) => {
        if (current.unlockedThemes.includes(themeId)) return current;
        return {
          ...current,
          totalPoints: current.totalPoints - theme.price,
          unlockedThemes: [...current.unlockedThemes, themeId],
          activeTheme: themeId,
          achievements: current.achievements.includes('aesthete')
            ? current.achievements
            : [...current.achievements, 'aesthete'],
        };
      });

      return { purchased: true };
    },
    [profile.totalPoints, profile.unlockedThemes, updateProfile],
  );

  const setActiveTheme = useCallback(
    (themeId: string) => {
      if (!getCosmeticThemeById(themeId) || !profile.unlockedThemes.includes(themeId)) {
        return false;
      }

      updateProfile((current) => ({ ...current, activeTheme: themeId }));
      return true;
    },
    [profile.unlockedThemes, updateProfile],
  );

  const purchaseAvatar = useCallback(
    (avatarId: string, price: number) => {
      if (profile.unlockedAvatars.includes(avatarId)) {
        return { purchased: false, reason: 'owned' as const };
      }
      if (profile.coins < price) {
        return { purchased: false, reason: 'coins' as const };
      }

      updateProfile((current) => ({
        ...current,
        coins: current.coins - price,
        unlockedAvatars: [...current.unlockedAvatars, avatarId],
        avatar: avatarId,
      }));

      return { purchased: true };
    },
    [profile.coins, profile.unlockedAvatars, updateProfile],
  );

  const setAvatar = useCallback(
    (avatarId: string) => {
      if (!profile.unlockedAvatars.includes(avatarId) && avatarId !== '') {
        return false;
      }
      updateProfile((current) => ({ ...current, avatar: avatarId }));
      return true;
    },
    [profile.unlockedAvatars, updateProfile],
  );

  const recordAnswerEvent = useCallback(
    ({ themeId, isCorrect, questionId, errorTag }: { themeId: string; isCorrect: boolean; questionId: string; errorTag?: string }) => {
      const map = new Map(
        STUDY_THEME_GROUPS.flatMap((g) => g.subthemes.map((s) => [s.themeId, s.id] as const)),
      );
      const subthemeId = map.get(themeId) ?? themeId;

      void studyRepo.appendAnswer({
        questionId,
        subthemeId,
        isCorrect,
        answeredAt: new Date().toISOString(),
        errorTag: errorTag ?? (isCorrect ? undefined : 'knowledge-gap'),
      }, userId);

      updateProfile((current) => {
        const nextMasteryState = updateMastery(current.studyMastery[subthemeId], isCorrect, errorTag ?? 'knowledge-gap');
        const nextAchievements = [...current.achievements];
        if (nextMasteryState.mastery >= 0.99 && !nextAchievements.includes('mastery-expert')) {
          nextAchievements.push('mastery-expert');
        }

        return {
          ...current,
          achievements: nextAchievements,
          studyMastery: {
            ...current.studyMastery,
            [subthemeId]: nextMasteryState,
          },
        };
      });

      trackEvent('question_answered', { questionId, subthemeId, isCorrect });
    },
    [updateProfile],
  );

  const value = useMemo(
    () => ({
      profile,
      globalStats,
      completeLevel,
      isLevelDone,
      saveSurvivalRun,
      saveMillionaireRun,
      unlockAchievement,
      purchaseTheme,
      setActiveTheme,
      refreshStats,
      setAvatar,
      purchaseAvatar,
      recordAnswerEvent,
    }),
    [
      profile,
      globalStats,
      completeLevel,
      isLevelDone,
      saveSurvivalRun,
      saveMillionaireRun,
      unlockAchievement,
      purchaseTheme,
      setActiveTheme,
      refreshStats,
      setAvatar,
      purchaseAvatar,
      recordAnswerEvent,
    ],
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
