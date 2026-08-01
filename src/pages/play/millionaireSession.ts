import { getMixedQuestionsByDifficulty } from '../../data/questions';
import { fetchQuestionsByIds } from '../../repos/questionsRepo';
import type { Difficulty, Question } from '../../types';
import {
  buildMillionaireSessionKey,
  loadGameSession,
  type MillionaireRunSession,
} from '../../lib/gameSession';

/** Prize coins per level (1–12 low, 13–15 meaningful). */
export const LEVEL_POINTS = [2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 25, 55, 85, 120];

export const MILLIONAIRE_MAX_LEVELS = LEVEL_POINTS.length;

export const MILLIONAIRE_PROGRESS_SEGMENTS = 5;

export function formatMillionaireCoins(amount: number): string {
  return amount.toLocaleString('uk-UA');
}

const DIFFICULTY_FALLBACK_ORDER: Difficulty[] = [
  'baby',
  'child',
  'youth',
  'student',
  'preacher',
  'teacher',
  'theologian',
];

function getDifficultyForLevel(level: number): Difficulty {
  if (level <= 2) return 'baby';
  if (level <= 4) return 'child';
  if (level <= 6) return 'youth';
  if (level <= 8) return 'student';
  if (level <= 10) return 'preacher';
  if (level <= 12) return 'teacher';
  return 'theologian';
}

function pickQuestionForLevel(level: number, excludeIds: string[]): Question | null {
  const primary = getDifficultyForLevel(level);
  const difficulties = [
    primary,
    ...DIFFICULTY_FALLBACK_ORDER.filter((difficulty) => difficulty !== primary),
  ];

  for (const difficulty of difficulties) {
    const [question] = getMixedQuestionsByDifficulty(difficulty, 1, excludeIds);
    if (question) return question;
  }

  return null;
}

export function buildMillionaireQuestions(): Question[] {
  const picked: Question[] = [];

  for (let level = 1; level <= MILLIONAIRE_MAX_LEVELS; level += 1) {
    const question = pickQuestionForLevel(
      level,
      picked.map((item) => item.id),
    );

    if (!question) break;
    picked.push(question);
  }

  return picked;
}

export const MILLIONAIRE_SESSION_KEY = buildMillionaireSessionKey();

export async function loadMillionaireRun(): Promise<{
  questions: Question[];
  session: MillionaireRunSession;
} | null> {
  const saved = loadGameSession<MillionaireRunSession>(MILLIONAIRE_SESSION_KEY);
  if (!saved?.questionIds.length) return null;
  const questions = await fetchQuestionsByIds(saved.questionIds);
  if (questions.length < 1 || questions.length !== saved.questionIds.length) return null;
  return { questions, session: saved };
}

