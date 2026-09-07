import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import type {
  CompletedLevel,
  DailyPlanItem,
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
import { generateRecommendations } from '../lib/recommendationEngine';
import { buildDailyPlan } from '../lib/dailyPlan';
import {
  advancePlayerRank,
  computeStageWisdom,
  getDefaultPlayerRank,
  getOrCreatePracticeTrack,
  PASS_MIN_CORRECT,
  getPracticeStageCount,
} from '../lib/practiceProgression';
import { loadAllTopicHierarchies } from '../data/topicDbLoader';
import type { BollsTranslation } from '../lib/bollsConstants';
import { normalizeBollsTranslation } from '../lib/bollsConstants';
import { isFeatureEnabled } from '../lib/flags';
import { hasApi } from '../repos/apiClient';
import {
  progressionRepo,
  type CompletionCommand,
  type ProgressionOutcome,
} from '../repos/progressionRepo';
import { getLearningObjectiveId } from '../lib/learningObjectives';
import { computeNextReviewState } from '../lib/reviewScheduler';
import { usePlayerProfileStore } from '../stores/playerProfileStore';
import { useGlobalStatsStore } from '../stores/globalStatsStore';
import {
  usePlayerProfileSync,
  useSavePlayerProfileMutation,
} from '../queries/usePlayerProfile';
import {
  useGlobalStatsSync,
  useRecordGlobalPlayMutation,
  useRefreshGlobalStats,
} from '../queries/useGlobalStats';

interface PlayerContextValue {
  profile: PlayerProfile;
  globalStats: GlobalStats;
  completeLevel: (
    themeId: string,
    difficulty: Difficulty,
    correctCount: number,
    totalQuestions: number,
  ) => Promise<{ points: number; alreadyCompleted: boolean }>;
  completePracticeStage: (
    themeId: string,
    difficulty: Difficulty,
    stageIndex: number,
    correctCount: number,
    totalQuestions: number,
    nodeId: string | null,
    questionIds?: string[],
  ) => Promise<{
    passed: boolean;
    points: number;
    wisdomEarned: number;
    stagePerfect: boolean;
    nextStageUnlocked: boolean;
    rankPromoted: boolean;
    previousRankLabel: string;
    newRankLabel: string;
    streakDays: number;
    celebrate: boolean;
  }>;
  isLevelDone: (themeId: string, difficulty: Difficulty) => boolean;
  saveSurvivalRun: (score: number, pointsEarned: number, runId?: string) => Promise<void>;
  saveMillionaireRun: (
    reachedLevel: number,
    pointsEarned: number,
    runLength: number,
    runId?: string,
  ) => Promise<void>;
  unlockAchievement: (achievementId: string) => boolean;
  purchaseTheme: (themeId: string) => Promise<{ purchased: boolean; reason?: 'missing' | 'owned' | 'coins' }>;
  setActiveTheme: (themeId: string) => boolean;
  refreshStats: () => void;
  setAvatar: (avatarId: string) => boolean;
  purchaseAvatar: (
    avatarId: string,
    price: number,
  ) => Promise<{ purchased: boolean; reason?: 'missing' | 'owned' | 'coins' }>;
  recordAnswerEvent: (params: { themeId: string; isCorrect: boolean; questionId: string; errorTag?: string; nodeId?: string }) => void;
  getRecommendations: (maxRecommendations?: number) => Promise<Recommendation[]>;
  getDailyPlan: () => Promise<DailyPlanItem[]>;
  setBibleTranslation: (translation: BollsTranslation) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

/**
 * The server-authoritative `/api/v1` command surface is the only remote path
 * (WS4 part 2 removed the `authoritative_profile` flag and the legacy fallback).
 * When there's no API base configured we run fully local.
 */
function authoritativeEnabled(): boolean {
  return hasApi();
}

/** sessionStorage set of authoritative event ids whose celebration has already played (ADR-010). */
const CELEBRATED_KEY = 'bible-game-celebrated-events';

function celebrationAlreadyPlayed(eventId: string): boolean {
  try {
    const seen = JSON.parse(sessionStorage.getItem(CELEBRATED_KEY) ?? '[]') as string[];
    if (seen.includes(eventId)) return true;
    sessionStorage.setItem(CELEBRATED_KEY, JSON.stringify([...seen, eventId].slice(-200)));
    return false;
  } catch {
    return false;
  }
}

async function purchaseViaServer(
  kind: 'theme' | 'avatar',
  itemId: string,
  persist: (next: PlayerProfile) => void,
  profile: PlayerProfile,
): Promise<{ purchased: boolean; reason?: 'missing' | 'owned' | 'coins' }> {
  try {
    const res = await progressionRepo.purchase({
      kind,
      itemId,
      idempotencyKey: `${kind}:${itemId}`,
    });
    persist({
      ...profile,
      coins: res.balance,
      unlockedThemes: res.unlockedThemes,
      unlockedAvatars: res.unlockedAvatars,
      activeTheme: res.activeTheme || profile.activeTheme,
      avatar: res.avatar || profile.avatar,
      achievements: res.achievementsGranted.length
        ? Array.from(new Set([...profile.achievements, ...res.achievementsGranted]))
        : profile.achievements,
    });
    return { purchased: true };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'insufficient_funds') return { purchased: false, reason: 'coins' };
    if (code === 'already_owned') return { purchased: false, reason: 'owned' };
    return { purchased: false, reason: 'missing' };
  }
}

/** Overlay the server-authoritative snapshot onto the local profile, keeping client-owned fields. */
function applyOutcome(current: PlayerProfile, outcome: ProgressionOutcome): PlayerProfile {
  const n = outcome.next;
  return {
    ...current,
    coins: n.coins,
    playerRank: {
      tier: n.rankTier,
      plaque: n.rankPlaque,
      wisdomPoints: n.wisdom,
      unlockedTier: n.rankUnlockedTier,
    },
    streakDays: n.streakDays,
    lastActiveAt: n.lastActiveAt,
    completedLevels: n.completedLevels as unknown as PlayerProfile['completedLevels'],
    achievements: n.achievements,
    themePoints: n.themePoints,
    practiceTracks: n.practiceTracks,
    studyMastery: n.studyMastery,
    millionaireWins: n.millionaireWins,
    millionaireMaxLevel: n.millionaireMaxLevel,
    survivalHighScore: n.survivalHighScore,
  };
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { userId, displayName } = useTelegram();
  const storedProfile = usePlayerProfileStore((s) => s.profile);
  const storedGlobalStats = useGlobalStatsStore((s) => s.globalStats);
  const setProfileInStore = usePlayerProfileStore((s) => s.setProfile);

  const profile =
    storedProfile?.userId === userId
      ? storedProfile
      : loadProfile(userId, displayName);
  const globalStats = storedGlobalStats ?? loadGlobalStats();

  const localDirtyRef = useRef(false);
  const profileSyncGen = useRef(0);

  usePlayerProfileSync(userId, displayName, localDirtyRef);
  useGlobalStatsSync(userId);
  const saveProfileMutation = useSavePlayerProfileMutation(userId);
  const recordPlayMutation = useRecordGlobalPlayMutation(userId);
  const refreshStats = useRefreshGlobalStats(userId);

  useEffect(() => {
    const gen = ++profileSyncGen.current;
    localDirtyRef.current = false;
    loadProfile(userId, displayName);

    void studyRepo.syncHistory();
    trackEvent('session_start', { userId });
    void flushTelemetry(userId);

    const timer = window.setInterval(() => {
      void flushTelemetry(userId);
    }, 15000);

    return () => {
      if (profileSyncGen.current === gen) {
        localDirtyRef.current = false;
      }
      window.clearInterval(timer);
    };
  }, [userId, displayName]);

  useEffect(() => {
    applyCosmeticThemeById(profile.activeTheme);
  }, [profile.activeTheme]);

  const persistProfile = useCallback(
    (next: PlayerProfile) => {
      localDirtyRef.current = true;
      setProfileInStore(next);
      saveProfileMutation.mutate(next);
    },
    [setProfileInStore, saveProfileMutation],
  );

  const isLevelDone = useCallback(
    (themeId: string, difficulty: Difficulty) =>
      profile.completedLevels.some(
        (l) => l.themeId === themeId && l.difficulty === difficulty,
      ),
    [profile.completedLevels],
  );

  const completeLevel = useCallback(
    async (
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

      if (authoritativeEnabled()) {
        const runId = `level:${themeId}:${difficulty}`;
        try {
          const outcome = await progressionRepo.completion({
            kind: 'level',
            runId,
            idempotencyKey: `${runId}:${correctCount}/${totalQuestions}`,
            difficulty,
            themeId,
            correctCount,
            totalQuestions,
          });
          persistProfile(applyOutcome(profile, outcome));
          trackEvent('quiz_completed', { themeId, difficulty, points: outcome.delta.coins, correctCount, totalQuestions });
          return { points: outcome.delta.coins, alreadyCompleted };
        } catch {
          /* fall through to local computation, mark nothing — retry on next run */
        }
      }
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

      persistProfile(next);
      trackEvent('quiz_completed', { themeId, difficulty, points, correctCount, totalQuestions });

      const hadThemePoints = (profile.themePoints[themeId] ?? 0) > 0;
      if (points > 0) {
        recordPlayMutation.mutate({ themeId, points, isNewPlayerForTheme: !hadThemePoints });
      }

      return { points, alreadyCompleted };
    },
    [profile, persistProfile, recordPlayMutation],
  );

  const completePracticeStage = useCallback(
    async (
      themeId: string,
      difficulty: Difficulty,
      stageIndex: number,
      correctCount: number,
      totalQuestions: number,
      nodeId: string | null,
      questionIds?: string[],
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

      if (authoritativeEnabled()) {
        const runId = `practice:${themeId}:${nodeId ?? '_root'}:${difficulty}:${stageIndex}`;
        try {
          const outcome = await progressionRepo.completion({
            kind: 'practice_stage',
            runId,
            idempotencyKey: `${runId}:${correctCount}/${totalQuestions}`,
            difficulty,
            themeId,
            nodeId,
            stageIndex,
            questionIds,
            correctCount,
            totalQuestions,
          });
          let nextProfile = applyOutcome(profile, outcome);

          // Review schedules stay client-owned (§7.4); persist the blob separately.
          if (isFeatureEnabled('review_scheduler_v2') && nodeId) {
            const learningObjectiveId = getLearningObjectiveId(themeId, nodeId);
            const nextSchedule = computeNextReviewState(
              (profile.reviewSchedules ?? {})[learningObjectiveId],
              { learningObjectiveId, themeId, nodeId },
              outcome.delta.passed ?? passed,
            );
            const reviewSchedules = { ...(profile.reviewSchedules ?? {}), [learningObjectiveId]: nextSchedule };
            nextProfile = { ...nextProfile, reviewSchedules };
            void progressionRepo.saveLearningState(reviewSchedules).catch(() => {});
          }

          persistProfile(nextProfile);
          trackEvent('practice_stage_completed', {
            themeId, difficulty, stageIndex, nodeId, passed,
            wisdomEarned: outcome.delta.wisdom, points: outcome.delta.coins, correctCount, totalQuestions,
          });
          const newRankLabel = formatRankLabel(outcome.next.rankTier, outcome.next.rankPlaque);
          return {
            passed: outcome.delta.passed ?? passed,
            points: outcome.delta.coins,
            wisdomEarned: outcome.delta.wisdom,
            stagePerfect: outcome.delta.stagePerfect ?? stagePerfectNow,
            nextStageUnlocked: outcome.delta.nextStageUnlocked ?? false,
            rankPromoted: outcome.delta.rankChanged,
            previousRankLabel,
            newRankLabel,
            streakDays: outcome.next.streakDays,
            celebrate: !celebrationAlreadyPlayed(outcome.eventId),
          };
        } catch {
          /* fall through to local computation */
        }
      }

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
      const bestWisdomBefore = existingStageResult?.passed
        ? computeStageWisdom(
            difficulty,
            bestCorrectBefore,
            Math.max(1, existingStageResult.total ?? totalQuestions),
          )
        : 0;
      const points = Math.max(0, currentStagePoints - bestPointsBefore);
      const wisdomEarned = Math.max(0, currentStageWisdom - bestWisdomBefore);
      const priorTotal = Math.max(1, existingStageResult?.total ?? totalQuestions);
      const historicalPerfect =
        Boolean(existingStageResult?.perfect)
        || (bestCorrectBefore === priorTotal && bestCorrectBefore === totalQuestions);
      const stagePerfect = historicalPerfect || stagePerfectNow;
      const stagePassed = Boolean(existingStageResult?.passed) || passed;

      const stageResult = {
        stageIndex,
        correct: correctCount,
        total: totalQuestions,
        attempts: (existingStageResult?.attempts ?? 0) + 1,
        questionIds: questionIds?.length ? questionIds : existingStageResult?.questionIds,
        bestCorrect: Math.max(bestCorrectBefore, correctCount),
        bestPointsAwarded: Math.max(bestPointsBefore, currentStagePoints),
        bestWisdomAwarded: Math.max(bestWisdomBefore, currentStageWisdom),
        perfect: stagePerfect,
        perfectCompletedAt: existingStageResult?.perfectCompletedAt
          ?? (stagePerfectNow ? new Date().toISOString() : undefined),
        passed: stagePassed,
        completedAt: new Date().toISOString(),
      };

      const maxStageIndex = getPracticeStageCount(nodeId, difficulty) - 1;
      const filteredResults = existingTrack.stageResults.filter((r) => r.stageIndex !== stageIndex);
      const nextHighestUnlocked = passed
        ? Math.max(
            existingTrack.highestUnlockedStage,
            Math.min(stageIndex + 1, maxStageIndex),
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

      const streaked = updateStreak(profile);

      let reviewSchedules = profile.reviewSchedules ?? {};
      if (isFeatureEnabled('review_scheduler_v2') && nodeId) {
        const learningObjectiveId = getLearningObjectiveId(themeId, nodeId);
        const nextSchedule = computeNextReviewState(
          reviewSchedules[learningObjectiveId],
          { learningObjectiveId, themeId, nodeId },
          passed,
        );
        reviewSchedules = { ...reviewSchedules, [learningObjectiveId]: nextSchedule };
      }

      const next: PlayerProfile = {
        ...streaked,
        coins: profile.coins + points,
        themePoints: {
          ...profile.themePoints,
          [themeId]: (profile.themePoints[themeId] ?? 0) + points,
        },
        practiceTracks: tracks,
        playerRank: newRank,
        achievements: updatedAchievements,
        reviewSchedules,
      };

      persistProfile(next);
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
        recordPlayMutation.mutate({ themeId, points, isNewPlayerForTheme: !hadThemePoints });
      }

      const nextStageUnlocked =
        passed &&
        stageIndex < maxStageIndex &&
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
        streakDays: streaked.streakDays,
        celebrate: true,
      };
    },
    [profile, userId, persistProfile, recordPlayMutation],
  );

  const updateProfile = useCallback(
    (updater: (current: PlayerProfile) => PlayerProfile) => {
      persistProfile(updater(profile));
    },
    [profile, persistProfile],
  );

  const runCompletion = useCallback(
    async (cmd: CompletionCommand): Promise<boolean> => {
      if (!authoritativeEnabled()) return false;
      try {
        const outcome = await progressionRepo.completion(cmd);
        persistProfile(applyOutcome(profile, outcome));
        return true;
      } catch {
        return false;
      }
    },
    [profile, persistProfile],
  );

  const saveSurvivalRun = useCallback(
    async (score: number, pointsEarned: number, runId?: string) => {
      const rid = runId ?? `survival:${Date.now()}`;
      const done = await runCompletion({
        kind: 'survival',
        runId: rid,
        idempotencyKey: rid,
        score,
      });
      if (done) return;
      updateProfile((current) => ({
        ...current,
        coins: current.coins + pointsEarned,
        survivalHighScore: Math.max(current.survivalHighScore, score),
      }));
    },
    [runCompletion, updateProfile],
  );

  const saveMillionaireRun = useCallback(
    async (reachedLevel: number, pointsEarned: number, runLength: number, runId?: string) => {
      const rid = runId ?? `millionaire:${Date.now()}`;
      const done = await runCompletion({
        kind: 'millionaire',
        runId: rid,
        idempotencyKey: rid,
        reachedLevel,
        runLength,
      });
      if (done) return;
      const completedRun = runLength > 0 && reachedLevel >= runLength;
      updateProfile((current) => ({
        ...current,
        coins: current.coins + pointsEarned,
        millionaireWins: completedRun ? current.millionaireWins + 1 : current.millionaireWins,
        millionaireMaxLevel: Math.max(current.millionaireMaxLevel, reachedLevel),
      }));
    },
    [runCompletion, updateProfile],
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
    async (themeId: string) => {
      const theme = getCosmeticThemeById(themeId);
      if (!theme) return { purchased: false, reason: 'missing' as const };
      if (profile.unlockedThemes.includes(themeId)) {
        return { purchased: false, reason: 'owned' as const };
      }

      if (authoritativeEnabled()) {
        return purchaseViaServer('theme', themeId, persistProfile, profile);
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
    [profile, persistProfile, updateProfile],
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
    async (avatarId: string, price: number) => {
      if (profile.unlockedAvatars.includes(avatarId)) {
        return { purchased: false, reason: 'owned' as const };
      }

      if (authoritativeEnabled()) {
        return purchaseViaServer('avatar', avatarId, persistProfile, profile);
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
    [profile, persistProfile, updateProfile],
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
      const effectiveNodeId = nodeId ?? subthemeId;

      void studyRepo.appendAnswer({
        questionId,
        subthemeId: effectiveNodeId,
        themeId,
        nodeId: nodeId ?? undefined,
        isCorrect,
        answeredAt: new Date().toISOString(),
        errorTag: errorTag ?? (isCorrect ? undefined : 'knowledge-gap'),
      });

      if (authoritativeEnabled()) {
        void progressionRepo
          .answer({
            questionId,
            themeId,
            nodeId: nodeId ?? undefined,
            subthemeId: effectiveNodeId,
            isCorrect,
            errorTag,
            idempotencyKey: `answer:${questionId}:${Date.now()}`,
          })
          .then((res) => {
            updateProfile((current) => ({
              ...current,
              studyMastery: { ...current.studyMastery, [res.nodeId]: res.mastery },
              achievements: res.achievementsGranted.length
                ? Array.from(new Set([...current.achievements, ...res.achievementsGranted]))
                : current.achievements,
            }));
          })
          .catch(() => {
            /* offline — local mastery below still applies */
          });
      } else {
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
      }

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

  const getDailyPlan = useCallback(async (): Promise<DailyPlanItem[]> => {
    try {
      const topicHierarchy = await loadAllTopicHierarchies();
      return buildDailyPlan({ profile, topicHierarchy });
    } catch (error) {
      console.error('Failed to build daily plan:', error);
      return [];
    }
  }, [profile]);

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
      getDailyPlan,
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
      getDailyPlan,
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
