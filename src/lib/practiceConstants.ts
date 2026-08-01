import type { Difficulty } from '../types';

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
