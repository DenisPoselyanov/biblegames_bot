import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  DIFFICULTY_ORDER,
  type Difficulty,
  type PlayerRank,
  type PracticeTrackProgress,
} from '../types';

export const PRACTICE_QUESTIONS_PER_STAGE = 10;
export const PASS_THRESHOLD = 0.7;
export const PASS_MIN_CORRECT = Math.ceil(PASS_THRESHOLD * PRACTICE_QUESTIONS_PER_STAGE);

export const STAGE_COUNT_BY_DIFFICULTY: Record<Difficulty, number> = {
  baby: 5,
  child: 5,
  youth: 5,
  student: 4,
  preacher: 4,
  teacher: 3,
  theologian: 3,
};

export const WISDOM_PER_STAGE_BASE: Record<Difficulty, number> = {
  baby: 5,
  child: 8,
  youth: 12,
  student: 18,
  preacher: 25,
  teacher: 35,
  theologian: 50,
};

/** MVP thresholds — easy to level up; rebalance later */
export const WISDOM_TO_NEXT_PLAQUE = 20;
export const WISDOM_TO_NEXT_TIER = 30;

const PLAQUE_ROMAN: Record<number, string> = {
  7: 'VII',
  6: 'VI',
  5: 'V',
  4: 'IV',
  3: 'III',
  2: 'II',
  1: 'I',
};

export function getDefaultPlayerRank(): PlayerRank {
  return {
    tier: 'baby',
    plaque: 7,
    wisdomPoints: 0,
    unlockedTier: 'child',
  };
}

export function getTrackKey(themeId: string, nodeId: string | null, difficulty: Difficulty): string {
  return `${themeId}::${nodeId ?? '_root'}::${difficulty}`;
}

export function parseTrackKey(key: string): { themeId: string; nodeId: string | null; difficulty: Difficulty } | null {
  const parts = key.split('::');
  if (parts.length !== 3) return null;
  const [themeId, nodePart, difficulty] = parts;
  if (!DIFFICULTIES.includes(difficulty as Difficulty)) return null;
  return {
    themeId,
    nodeId: nodePart === '_root' ? null : nodePart,
    difficulty: difficulty as Difficulty,
  };
}

export function findPracticeTrack(
  tracks: PracticeTrackProgress[],
  themeId: string,
  nodeId: string | null,
  difficulty: Difficulty,
): PracticeTrackProgress | undefined {
  return tracks.find(
    (t) => t.themeId === themeId && t.nodeId === nodeId && t.difficulty === difficulty,
  );
}

export function getOrCreatePracticeTrack(
  tracks: PracticeTrackProgress[],
  themeId: string,
  nodeId: string | null,
  difficulty: Difficulty,
): PracticeTrackProgress {
  const existing = findPracticeTrack(tracks, themeId, nodeId, difficulty);
  if (existing) return existing;
  return {
    themeId,
    nodeId,
    difficulty,
    highestUnlockedStage: 0,
    stageResults: [],
  };
}

export function countPassedStages(track: PracticeTrackProgress): number {
  return track.stageResults.filter((r) => r.passed).length;
}

export function isStageUnlocked(track: PracticeTrackProgress, stageIndex: number): boolean {
  return stageIndex <= track.highestUnlockedStage;
}

export function isStagePassed(track: PracticeTrackProgress, stageIndex: number): boolean {
  return track.stageResults.some((r) => r.stageIndex === stageIndex && r.passed);
}

export function canPlayDifficulty(playerRank: PlayerRank, difficulty: Difficulty): boolean {
  return DIFFICULTY_ORDER[playerRank.tier] >= DIFFICULTY_ORDER[difficulty];
}

export function isGlobalRankUnlocked(playerRank: PlayerRank, tier: Difficulty): boolean {
  return DIFFICULTY_ORDER[tier] <= DIFFICULTY_ORDER[playerRank.unlockedTier];
}

export function isGlobalRankAchieved(playerRank: PlayerRank, tier: Difficulty): boolean {
  return DIFFICULTY_ORDER[playerRank.tier] > DIFFICULTY_ORDER[tier];
}

export function formatPlaqueRoman(plaque: number): string {
  return PLAQUE_ROMAN[plaque] ?? String(plaque);
}

export function formatRankLabel(tier: Difficulty, plaque: number): string {
  return `${DIFFICULTY_LABELS[tier]} · ${formatPlaqueRoman(plaque)}`;
}

export function computeStageWisdom(difficulty: Difficulty, correct: number, total: number): number {
  if (total <= 0 || correct <= 0) return 0;
  const base = WISDOM_PER_STAGE_BASE[difficulty];
  const accuracy = correct / total;
  let wisdom = Math.round(base * accuracy);
  if (correct === total) {
    wisdom = Math.round(wisdom * 1.5);
  }
  return Math.max(0, wisdom);
}

export function computeWisdomProgress(playerRank: PlayerRank): {
  current: number;
  required: number;
  label: string;
} {
  if (playerRank.plaque > 1) {
    return {
      current: playerRank.wisdomPoints % WISDOM_TO_NEXT_PLAQUE,
      required: WISDOM_TO_NEXT_PLAQUE,
      label: `До плашки ${formatPlaqueRoman(playerRank.plaque - 1)}`,
    };
  }
  const nextTierIndex = DIFFICULTY_ORDER[playerRank.tier] + 1;
  if (nextTierIndex >= DIFFICULTIES.length) {
    return {
      current: playerRank.wisdomPoints,
      required: WISDOM_TO_NEXT_TIER,
      label: 'Максимальний ранг',
    };
  }
  const nextTier = DIFFICULTIES[nextTierIndex];
  return {
    current: playerRank.wisdomPoints % WISDOM_TO_NEXT_TIER,
    required: WISDOM_TO_NEXT_TIER,
    label: `До ${DIFFICULTY_LABELS[nextTier]}`,
  };
}

function nextUnlockedTierAfterPromotion(tier: Difficulty): Difficulty {
  const idx = DIFFICULTY_ORDER[tier] + 1;
  if (idx + 1 < DIFFICULTIES.length) {
    return DIFFICULTIES[idx + 1];
  }
  return DIFFICULTIES[Math.min(idx, DIFFICULTIES.length - 1)];
}

export function advancePlayerRank(current: PlayerRank, wisdomDelta: number): PlayerRank {
  if (wisdomDelta <= 0) {
    return current;
  }

  let { tier, plaque, wisdomPoints, unlockedTier } = current;
  wisdomPoints += wisdomDelta;

  while (true) {
    if (plaque > 1) {
      if (wisdomPoints >= WISDOM_TO_NEXT_PLAQUE) {
        wisdomPoints -= WISDOM_TO_NEXT_PLAQUE;
        plaque -= 1;
        continue;
      }
      break;
    }

    const tierIndex = DIFFICULTY_ORDER[tier];
    if (tierIndex >= DIFFICULTIES.length - 1) {
      break;
    }

    if (wisdomPoints >= WISDOM_TO_NEXT_TIER) {
      wisdomPoints -= WISDOM_TO_NEXT_TIER;
      tier = DIFFICULTIES[tierIndex + 1];
      plaque = 7;

      const newUnlocked = nextUnlockedTierAfterPromotion(tier);
      if (DIFFICULTY_ORDER[newUnlocked] > DIFFICULTY_ORDER[unlockedTier]) {
        unlockedTier = newUnlocked;
      }
      continue;
    }
    break;
  }

  return { tier, plaque, wisdomPoints, unlockedTier };
}

export function requiredQuestionsForDifficulty(difficulty: Difficulty): number {
  return STAGE_COUNT_BY_DIFFICULTY[difficulty] * PRACTICE_QUESTIONS_PER_STAGE;
}

export function stagesPossibleFromPool(poolSize: number): number {
  return Math.floor(poolSize / PRACTICE_QUESTIONS_PER_STAGE);
}

export function practiceGap(poolSize: number, difficulty: Difficulty): number {
  return Math.max(0, requiredQuestionsForDifficulty(difficulty) - poolSize);
}

export function isPracticeReady(poolSize: number, difficulty: Difficulty): boolean {
  return poolSize >= requiredQuestionsForDifficulty(difficulty);
}

export const TOTAL_PRACTICE_STAGES_PER_NODE = DIFFICULTIES.reduce(
  (sum, difficulty) => sum + STAGE_COUNT_BY_DIFFICULTY[difficulty],
  0,
);

/** Прогрес вузла теми: пройдені етапи практики / усі етапи всіх рангів (0–100). */
export function computeNodePracticeProgressPercent(
  tracks: PracticeTrackProgress[],
  themeId: string,
  nodeId: string | null,
): number {
  let passed = 0;
  for (const difficulty of DIFFICULTIES) {
    const track = findPracticeTrack(tracks, themeId, nodeId, difficulty);
    if (track) passed += countPassedStages(track);
  }
  if (TOTAL_PRACTICE_STAGES_PER_NODE <= 0) return 0;
  return Math.round((passed / TOTAL_PRACTICE_STAGES_PER_NODE) * 100);
}

export function getDifficultyUnlockRankLabel(difficulty: Difficulty): string {
  return DIFFICULTY_LABELS[difficulty];
}

export function getDifficultyUnlockRequirement(difficulty: Difficulty): string {
  if (difficulty === 'baby') return '';
  return `Потрібен ранг ${DIFFICULTY_LABELS[difficulty]}`;
}

export function getStageQuizPath(
  themeId: string,
  difficulty: Difficulty,
  stageIndex: number,
  nodeId?: string | null,
): string {
  const base = `/play/study/quiz/${themeId}/${difficulty}/stage/${stageIndex}`;
  if (nodeId) {
    return `${base}/${nodeId}`;
  }
  return base;
}
