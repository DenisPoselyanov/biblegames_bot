export const GAME_SESSION_VERSION = 1;
export const GAME_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const STORAGE_PREFIX = 'bible-game-run:';

export interface GameSessionEnvelope<T> {
  version: number;
  savedAt: number;
  data: T;
}

export interface QuizRunSession {
  questionIds: string[];
  index: number;
  correctCount: number;
  finished: boolean;
  showResult: boolean;
  selected: number | null;
  /** Unix ms when current question timer ends (preferred over questionTimeLeft) */
  deadlineAt?: number;
  /** @deprecated restored into deadlineAt */
  questionTimeLeft?: number;
  earnedPoints?: number;
  earnedWisdom?: number;
  stagePassed?: boolean;
  stagePerfect?: boolean;
  nextStageUnlocked?: boolean;
  rankPromoted?: boolean;
  newRankLabel?: string;
}

export interface MillionaireRunSession {
  questionIds: string[];
  index: number;
  selected: number | null;
  hiddenOptions: number[];
  usedFiftyFifty: boolean;
  usedSwap: boolean;
  usedSecondChance: boolean;
  secondChanceActive: boolean;
  blockedWrongOptions: number[];
  status: 'playing' | 'answered' | 'finished';
  notice: string | null;
  result: { title: string; points: number; reachedLevel: number } | null;
}

export interface SurvivalRunSession {
  seenQuestionIds: string[];
  currentQuestionId: string;
  lives: number;
  score: number;
  points: number;
  timeLeft: number;
  selected: number | null;
  status: 'playing' | 'answered' | 'finished';
  lastAnswerCorrect: boolean | null;
}

export function buildQuizSessionKey(
  mode: 'practice' | 'review',
  themeId?: string,
  difficulty?: string,
  nodeId?: string | null,
  stageIndex?: number,
): string {
  if (mode === 'review') return `${STORAGE_PREFIX}quiz:review`;
  return `${STORAGE_PREFIX}quiz:practice:${themeId ?? ''}:${difficulty ?? ''}:${nodeId ?? ''}:${stageIndex ?? 0}`;
}

export function buildMillionaireSessionKey(): string {
  return `${STORAGE_PREFIX}millionaire`;
}

export function buildSurvivalSessionKey(): string {
  return `${STORAGE_PREFIX}survival`;
}

export function loadGameSession<T>(sessionKey: string): T | null {
  try {
    const raw = sessionStorage.getItem(sessionKey);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as GameSessionEnvelope<T>;
    if (envelope.version !== GAME_SESSION_VERSION) {
      sessionStorage.removeItem(sessionKey);
      return null;
    }
    if (Date.now() - envelope.savedAt > GAME_SESSION_TTL_MS) {
      sessionStorage.removeItem(sessionKey);
      return null;
    }
    return envelope.data;
  } catch {
    return null;
  }
}

export function saveGameSession<T>(sessionKey: string, data: T): void {
  try {
    const envelope: GameSessionEnvelope<T> = {
      version: GAME_SESSION_VERSION,
      savedAt: Date.now(),
      data,
    };
    sessionStorage.setItem(sessionKey, JSON.stringify(envelope));
  } catch {
    /* quota / private mode */
  }
}

export function clearGameSession(sessionKey: string): void {
  try {
    sessionStorage.removeItem(sessionKey);
  } catch {
    /* ignore */
  }
}
