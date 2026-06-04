import type { AnswerEvent, Difficulty, PracticeTrackProgress } from '../types';
import type { PracticePickOptions } from '../data/questions';
import {
  findPracticeTrack,
  getOrCreatePracticeTrack,
} from './practiceProgression';
import { studyRepo } from '../repos/studyRepo';

const QUIZ_RUN_NONCE_PREFIX = 'bible-quiz-run:';

export type PracticePickContext = {
  themeId: string;
  difficulty: Difficulty;
  nodeId: string | null;
  practiceTracks: PracticeTrackProgress[];
  sessionKey: string;
  freshRun: boolean;
  aggregateThemeIds?: string[];
};

/** Match answer history rows to the current practice track (theme, subtopic, or aggregate). */
export function collectExcludeQuestionIds(context: PracticePickContext): string[] {
  const { themeId, nodeId, aggregateThemeIds } = context;
  const history = studyRepo.getAnswerHistory();
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const event of history) {
    if (!isAnswerForPracticeContext(event, themeId, nodeId, aggregateThemeIds)) continue;
    if (seen.has(event.questionId)) continue;
    seen.add(event.questionId);
    ids.push(event.questionId);
  }
  return ids;
}

export function isAnswerForPracticeContext(
  event: AnswerEvent,
  themeId: string,
  nodeId: string | null,
  aggregateThemeIds?: string[],
): boolean {
  const key = event.nodeId ?? event.subthemeId;
  if (nodeId) return key === nodeId;
  if (aggregateThemeIds?.length) {
    return key === themeId || aggregateThemeIds.includes(event.themeId ?? '');
  }
  if (event.themeId && event.themeId === themeId) return true;
  return key === themeId || key.startsWith(`${themeId}-`);
}

export function buildPracticePickOptions(context: PracticePickContext): PracticePickOptions {
  const { themeId, difficulty, nodeId, practiceTracks, sessionKey, freshRun } = context;
  const track =
    findPracticeTrack(practiceTracks, themeId, nodeId, difficulty)
    ?? getOrCreatePracticeTrack([], themeId, nodeId, difficulty);
  const nonceKey = `${QUIZ_RUN_NONCE_PREFIX}${sessionKey}`;
  if (freshRun) {
    sessionStorage.setItem(nonceKey, String(Date.now()));
  }
  return {
    practiceTrack: track,
    excludeIds: collectExcludeQuestionIds(context),
    runNonce: sessionStorage.getItem(nonceKey) ?? String(Date.now()),
  };
}
