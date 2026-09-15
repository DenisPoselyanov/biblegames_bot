/**
 * Legacy whole-blob answer path (Phase 1 §7.2) — used when no database
 * service is wired (`ServerStore` json/legacy provider). Shared by
 * `server/routes/progression.ts` (`POST /progression/answers`) and
 * `server/services/learningService.ts` (practice-session answers, §12.2) so
 * the latter extends this authority instead of forking a parallel one.
 */
import type { ServerStore } from '../db/store';
import type { MasteryState } from '../../src/types/index';
import { emptyProfile } from '../services/profileService';
import { updateMastery, MASTERY_EXPERT_THRESHOLD } from './masteryMath';

export interface AnswerBody {
  questionId: string;
  idempotencyKey: string;
  isCorrect: boolean;
  nodeId: string;
  errorTag: string;
}

export interface AnswerBlobOutcome {
  nodeId: string;
  mastery: MasteryState;
  achievementsGranted: string[];
  answeredAt: string;
}

export async function applyAnswerBlob(args: {
  dbStore: ServerStore;
  userId: string;
  body: AnswerBody;
}): Promise<AnswerBlobOutcome> {
  const { dbStore, userId, body } = args;
  const stored = (await dbStore.getProfile(userId)) ?? emptyProfile(userId);
  const mastery =
    stored.studyMastery && typeof stored.studyMastery === 'object'
      ? (stored.studyMastery as Record<string, MasteryState>)
      : {};
  const nextState = updateMastery(mastery[body.nodeId], body.isCorrect, body.errorTag);
  const nextMastery = { ...mastery, [body.nodeId]: nextState };

  const achievements = Array.isArray(stored.achievements) ? [...(stored.achievements as string[])] : [];
  const granted: string[] = [];
  if (nextState.mastery >= MASTERY_EXPERT_THRESHOLD && !achievements.includes('mastery-expert')) {
    achievements.push('mastery-expert');
    granted.push('mastery-expert');
  }

  await dbStore.setProfile(userId, {
    ...stored,
    studyMastery: nextMastery,
    achievements,
    updatedAt: new Date().toISOString(),
  });

  const answeredAt = new Date().toISOString();
  const history = await dbStore.getStudyAnswers(userId);
  history.push({
    questionId: body.questionId,
    subthemeId: body.nodeId,
    nodeId: body.nodeId,
    isCorrect: body.isCorrect,
    answeredAt,
    errorTag: body.isCorrect ? undefined : body.errorTag,
  });
  await dbStore.setStudyAnswers(userId, history.slice(-5000));

  return { nodeId: body.nodeId, mastery: nextState, achievementsGranted: granted, answeredAt };
}
