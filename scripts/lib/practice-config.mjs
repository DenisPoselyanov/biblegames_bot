/**
 * Practice progression constants (mirror of src/lib/practiceProgression.ts).
 * Keep in sync when changing stage counts or questions per stage.
 */

export const PRACTICE_QUESTIONS_PER_STAGE = 10;

export const STAGE_COUNT_BY_DIFFICULTY = {
  baby: 5,
  child: 5,
  youth: 5,
  student: 4,
  preacher: 4,
  teacher: 3,
  theologian: 3,
};

/** Minimum questions per difficulty for full practice path */
export function requiredQuestionsForDifficulty(difficulty) {
  const stages = STAGE_COUNT_BY_DIFFICULTY[difficulty] ?? 5;
  return stages * PRACTICE_QUESTIONS_PER_STAGE;
}

export function stagesPossibleFromPool(poolSize) {
  return Math.floor(poolSize / PRACTICE_QUESTIONS_PER_STAGE);
}

export function practiceGap(poolSize, difficulty) {
  const required = requiredQuestionsForDifficulty(difficulty);
  return Math.max(0, required - poolSize);
}

export function isPracticeReady(poolSize, difficulty) {
  return poolSize >= requiredQuestionsForDifficulty(difficulty);
}
