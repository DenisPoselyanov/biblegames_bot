import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  CompletedLevel,
  Difficulty,
  GlobalStats,
  PlayerProfile,
  Recommendation,
} from '../types';
import { DIFFICULTY_POINTS, DIFFICULTY_ORDER } from '../types';
import { formatRankLabel } from '../lib/practiceProgression';
import { loadGlobalStats, loadProfile } from '../lib/storage';
import { useTelegram } from '../hooks/useTelegram';
import { getAchievementById } from '../data/achievements';
import { getCosmeticThemeById } from '../data/cosmetics';
import { applyCosmeticThemeById } from '../lib/cosmeticTheme';
import { STUDY_THEME_GROUPS } from '../data/study_themes';
import { updateMastery, updateStreak } from '../lib/learning';
import { flushTelemetry, trackEvent } from '../lib/telemetry';
import { studyRepo } from '../repos/studyRepo';
import { playerRepo } from '../repos/playerRepo';
import { statsRepo } from '../repos/statsRepo';
import { generateRecommendations } from '../lib/recommendationEngine';
import {
  advancePlayerRank,
  computeStageWisdom,
  getDefaultPlayerRank,
  getOrCreatePracticeTrack,
  PASS_MIN_CORRECT,
  STAGE_COUNT_BY_DIFFICULTY,
} from '../lib/practiceProgression';
import { loadAllTopicHierarchies } from '../data/topicDbLoader';
import type { BollsTranslation } from '../lib/bollsConstants';
import { normalizeBollsTranslation } from '../lib/bollsConstants';

interface PlayerContextValue {
  profile: PlayerProfile;
  globalStats: GlobalStats;
  completeLevel: (
    themeId: string,
    difficulty: Difficulty,
    correctCount: number,
    totalQuestions: number,
  ) => { points: number; alreadyCompleted: boolean };
  completePracticeStage: (
    themeId: string,
    difficulty: Difficulty,
    stageIndex: number,
    correctCount: number,
    totalQuestions: number,
    nodeId: string | null,
  ) => {
    passed: boolean;
    points: number;
    wisdomEarned: number;
    stagePerfect: boolean;
    nextStageUnlocked: boolean;
    rankPromoted: boolean;
    previousRankLabel: string;
    newRankLabel: string;
  };
  isLevelDone: (themeId: string, difficulty: Difficulty) => boolean;
  saveSurvivalRun: (score: number, pointsEarned: number) => void;
  saveMillionaireRun: (reachedLevel: number, pointsEarned: number, runLength: number) => void;
  unlockAchievement: (achievementId: string) => boolean;
  purchaseTheme: (themeId: string) => { purchased: boolean; reason?: 'missing' | 'owned' | 'coins' };
  setActiveTheme: (themeId: string) => boolean;
  refreshStats: () => void;
  setAvatar: (avatarId: string) => boolean;
  purchaseAvatar: (avatarId: string, price: number) => { purchased: boolean; reason?: 'owned' | 'coins' };
  recordAnswerEvent: (params: { themeId: string; isCorrect: boolean; questionId: string; errorTag?: string; nodeId?: string }) => void;
  getRecommendations: (maxRecommendations?: number) => Promise<Recommendation[]>;
  setBibleTranslation: (translation: BollsTranslation) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { userId, displayName } = useTelegram();
  const [profile, setProfile] = useState<PlayerProfile>(() =>
    loadProfile(userId, displayName),
  );
  const [globalStats, setGlobalStats] = useState<GlobalStats>(loadGlobalStats);
  const profileSyncGen = useRef(0);
  const localDirtyRef = useRef(false);

  useEffect(() => {
    const gen = ++profileSyncGen.current;
    localDirtyRef.current = false;
    void playerRepo.get(userId, displayName).then((remote) => {
      if (profileSyncGen.current !== gen) return;
      if (!localDirtyRef.current) {
        setProfile(remote);
      }
    });
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
    applyCosmeticThemeById(profile.activeTheme);
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
      if (totalQuestions <= 0) {
        return { points: 0, alreadyCompleted: false };
      }

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
        (themeId === 'geography' || themeId === 'geography-nt') &&
        difficulty === 'teacher' &&
        correctCount === totalQuestions &&
        !updatedAchievements.includes('cartographer')
      ) {
        updatedAchievements.push('cartographer');
      }

      const next: PlayerProfile = {
        ...updateStreak(profile),
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

      localDirtyRef.current = true;
      setProfile(next);
      void playerRepo.save(next);
      trackEvent('quiz_completed', { themeId, difficulty, points, correctCount, totalQuestions });

      const hadThemePoints = (profile.themePoints[themeId] ?? 0) > 0;
      void statsRepo.recordPlay(themeId, points, !hadThemePoints, userId).then(setGlobalStats);

      return { points, alreadyCompleted };
    },
    [profile],
  );

  const completePracticeStage = useCallback(
    (
      themeId: string,
      difficulty: Difficulty,
      stageIndex: number,
      correctCount: number,
      totalQuestions: number,
      nodeId: string | null,
    ) => {
      const passed = correctCount >= PASS_MIN_CORRECT;
      const total = totalQuestions > 0 ? totalQuestions : 1;
      const basePoints = DIFFICULTY_POINTS[difficulty];
      const accuracy = correctCount / total;
      const currentStagePoints = passed ? Math.round(basePoints * accuracy) : 0;
      const currentStageWisdom = passed ? computeStageWisdom(difficulty, correctCount, total) : 0;
      const stagePerfectNow = totalQuestions > 0 && correctCount === totalQuestions;

      const previousRank = profile.playerRank ?? getDefaultPlayerRank();
      const previousRankLabel = formatRankLabel(previousRank.tier, previousRank.plaque);

      const tracks = [...(profile.practiceTracks ?? [])];
      const trackTemplate = getOrCreatePracticeTrack(tracks, themeId, nodeId, difficulty);
      const trackIndex = tracks.findIndex(
        (t) => t.themeId === themeId && t.nodeId === nodeId && t.difficulty === difficulty,
      );
      const existingTrack = trackIndex >= 0 ? tracks[trackIndex] : trackTemplate;
      const existingStageResult = existingTrack.stageResults.find((r) => r.stageIndex === stageIndex);
      const bestCorrectBefore = existingStageResult?.bestCorrect ?? existingStageResult?.correct ?? 0;
      const bestPointsBefore = existingStageResult?.bestPointsAwarded
        ?? (existingStageResult?.passed
          ? Math.round(basePoints * (bestCorrectBefore / Math.max(1, existingStageResult.total ?? 1)))
          : 0);
      const bestWisdomBefore = existingStageResult?.bestWisdomAwarded
        ?? (existingStageResult?.passed
          ? computeStageWisdom(
              difficulty,
              bestCorrectBefore,
              Math.max(1, existingStageResult.total ?? 1),
            )
          : 0);
      const points = Math.max(0, currentStagePoints - bestPointsBefore);
      const wisdomEarned = Math.max(0, currentStageWisdom - bestWisdomBefore);
      const historicalPerfect = (existingStageResult?.bestCorrect ?? existingStageResult?.correct ?? 0)
        >= Math.max(1, existingStageResult?.total ?? 1);
      const stagePerfect = Boolean(existingStageResult?.perfect) || historicalPerfect || stagePerfectNow;
      const stagePassed = Boolean(existingStageResult?.passed) || passed;

      const stageResult = {
        stageIndex,
        correct: correctCount,
        total: totalQuestions,
        bestCorrect: Math.max(bestCorrectBefore, correctCount),
        bestPointsAwarded: Math.max(bestPointsBefore, currentStagePoints),
        bestWisdomAwarded: Math.max(bestWisdomBefore, currentStageWisdom),
        perfect: stagePerfect,
        perfectCompletedAt: existingStageResult?.perfectCompletedAt
          ?? (stagePerfectNow ? new Date().toISOString() : undefined),
        passed: stagePassed,
        completedAt: new Date().toISOString(),
      };

      const filteredResults = existingTrack.stageResults.filter((r) => r.stageIndex !== stageIndex);
      const nextHighestUnlocked = passed
        ? Math.max(
            existingTrack.highestUnlockedStage,
            Math.min(stageIndex + 1, STAGE_COUNT_BY_DIFFICULTY[difficulty] - 1),
          )
        : existingTrack.highestUnlockedStage;

      const updatedTrack = {
        ...existingTrack,
        highestUnlockedStage: passed
          ? Math.max(existingTrack.highestUnlockedStage, nextHighestUnlocked)
          : existingTrack.highestUnlockedStage,
        stageResults: [...filteredResults, stageResult].sort((a, b) => a.stageIndex - b.stageIndex),
      };

      if (trackIndex >= 0) {
        tracks[trackIndex] = updatedTrack;
      } else {
        tracks.push(updatedTrack);
      }

      const newRank = passed
        ? advancePlayerRank(previousRank, wisdomEarned)
        : previousRank;
      const rankPromoted =
        wisdomEarned > 0 &&
        (DIFFICULTY_ORDER[newRank.tier] > DIFFICULTY_ORDER[previousRank.tier] ||
          newRank.plaque < previousRank.plaque);

      const updatedAchievements = [...profile.achievements];
      if (stagePerfectNow && !updatedAchievements.includes('flawless-level')) {
        updatedAchievements.push('flawless-level');
      }

      const next: PlayerProfile = {
        ...updateStreak(profile),
        coins: profile.coins + points,
        themePoints: {
          ...profile.themePoints,
          [themeId]: (profile.themePoints[themeId] ?? 0) + points,
        },
        practiceTracks: tracks,
        playerRank: newRank,
        achievements: updatedAchievements,
      };

      localDirtyRef.current = true;
      setProfile(next);
      void playerRepo.save(next);
      trackEvent('practice_stage_completed', {
        themeId,
        difficulty,
        stageIndex,
        nodeId,
        passed,
        wisdomEarned,
        points,
        correctCount,
        totalQuestions,
      });

      if (points > 0) {
        const hadThemePoints = (profile.themePoints[themeId] ?? 0) > 0;
        void statsRepo.recordPlay(themeId, points, !hadThemePoints, userId).then(setGlobalStats);
      }

      const nextStageUnlocked =
        passed &&
        stageIndex < STAGE_COUNT_BY_DIFFICULTY[difficulty] - 1 &&
        updatedTrack.highestUnlockedStage >= stageIndex + 1;

      return {
        passed,
        points,
        wisdomEarned,
        stagePerfect,
        nextStageUnlocked,
        rankPromoted,
        previousRankLabel,
        newRankLabel: formatRankLabel(newRank.tier, newRank.plaque),
      };
    },
    [profile, userId],
  );

  const updateProfile = useCallback((updater: (current: PlayerProfile) => PlayerProfile) => {
    setProfile((current) => {
      const next = updater(current);
      localDirtyRef.current = true;
      void playerRepo.save(next);
      return next;
    });
  }, []);

  const saveSurvivalRun = useCallback(
    (score: number, pointsEarned: number) => {
      updateProfile((current) => ({
        ...current,
        coins: current.coins + pointsEarned,
        survivalHighScore: Math.max(current.survivalHighScore, score),
      }));
    },
    [updateProfile],
  );

  const saveMillionaireRun = useCallback(
    (reachedLevel: number, pointsEarned: number, runLength: number) => {
      const completedRun = runLength > 0 && reachedLevel >= runLength;
      updateProfile((current) => ({
        ...current,
        coins: current.coins + pointsEarned,
        millionaireWins: completedRun ? current.millionaireWins + 1 : current.millionaireWins,
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
      if (profile.coins < theme.price) {
        return { purchased: false, reason: 'coins' as const };
      }

      updateProfile((current) => {
        if (current.unlockedThemes.includes(themeId)) return current;
        return {
          ...current,
          coins: current.coins - theme.price,
          unlockedThemes: [...current.unlockedThemes, themeId],
          activeTheme: themeId,
          achievements: current.achievements.includes('aesthete')
            ? current.achievements
            : [...current.achievements, 'aesthete'],
        };
      });

      return { purchased: true };
    },
    [profile.coins, profile.unlockedThemes, updateProfile],
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
    ({ themeId, isCorrect, questionId, errorTag, nodeId }: { themeId: string; isCorrect: boolean; questionId: string; errorTag?: string; nodeId?: string }) => {
      const map = new Map(
        STUDY_THEME_GROUPS.flatMap((g) => g.subthemes.map((s) => [s.themeId, s.id] as const)),
      );
      const subthemeId = map.get(themeId) ?? themeId;
      // Використовуємо nodeId якщо є, інакше subthemeId
      const effectiveNodeId = nodeId ?? subthemeId;

      void studyRepo.appendAnswer({
        questionId,
        subthemeId: effectiveNodeId, // Оновлено для ієрархічного контексту
        isCorrect,
        answeredAt: new Date().toISOString(),
        errorTag: errorTag ?? (isCorrect ? undefined : 'knowledge-gap'),
      }, userId);

      updateProfile((current) => {
        const nextMasteryState = updateMastery(current.studyMastery[effectiveNodeId], isCorrect, errorTag ?? 'knowledge-gap');
        const nextAchievements = [...current.achievements];
        if (nextMasteryState.mastery >= 0.99 && !nextAchievements.includes('mastery-expert')) {
          nextAchievements.push('mastery-expert');
        }

        return {
          ...current,
          achievements: nextAchievements,
          studyMastery: {
            ...current.studyMastery,
            [effectiveNodeId]: nextMasteryState,
          },
        };
      });

      trackEvent('question_answered', { questionId, subthemeId: effectiveNodeId, nodeId, isCorrect });
    },
    [updateProfile, userId],
  );

  const setBibleTranslation = useCallback(
    (translation: BollsTranslation) => {
      const nextTranslation = normalizeBollsTranslation(translation);
      updateProfile((current) => ({
        ...current,
        bibleTranslation: nextTranslation,
      }));
      trackEvent('bible_translation_changed', { translation: nextTranslation });
    },
    [updateProfile],
  );

  const getRecommendations = useCallback(
    async (maxRecommendations = 5): Promise<Recommendation[]> => {
      try {
        const topicHierarchy = await loadAllTopicHierarchies();
        return generateRecommendations(
          {
            profile,
            topicHierarchy,
          },
          maxRecommendations,
        );
      } catch (error) {
        console.error('Failed to generate recommendations:', error);
        return [];
      }
    },
    [profile],
  );

  const value = useMemo(
    () => ({
      profile,
      globalStats,
      completeLevel,
      completePracticeStage,
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
      getRecommendations,
      setBibleTranslation,
    }),
    [
      profile,
      globalStats,
      completeLevel,
      completePracticeStage,
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
      getRecommendations,
      setBibleTranslation,
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
