import type { Difficulty, Question } from '../../src/types/index';
import { applyDiskMutations, normalizeCorrectIndex } from '../questionMutations';

type QuestionRow = {
  id: string;
  theme_id: string;
  difficulty: string;
  topic_node_id: string | null;
  source: string;
  payload: Record<string, unknown>;
};

export function rowToQuestion(row: QuestionRow): Question {
  const payload = row.payload ?? {};
  const correctIndex = normalizeCorrectIndex(
    payload.correctIndex ?? (payload as { correct?: number }).correct,
  );
  return {
    ...(payload as unknown as Question),
    id: row.id,
    themeId: row.theme_id,
    difficulty: row.difficulty as Difficulty,
    topicNodeId: row.topic_node_id ?? (payload.topicNodeId as string | undefined),
    topicPath: payload.topicPath as string | undefined,
    text: String(payload.text ?? ''),
    options: Array.isArray(payload.options) ? (payload.options as string[]) : [],
    correctIndex,
    reference: payload.reference as string | undefined,
    sourceQuality: payload.sourceQuality as Question['sourceQuality'],
    createdAt: payload.createdAt as string | undefined,
  };
}

export function questionToRow(q: Question, source: string): {
  id: string;
  theme_id: string;
  difficulty: string;
  topic_node_id: string | null;
  source: string;
  payload: Record<string, unknown>;
} {
  const { id, themeId, difficulty, topicNodeId, ...rest } = q;
  return {
    id,
    theme_id: themeId,
    difficulty,
    topic_node_id: topicNodeId ?? null,
    source,
    payload: {
      ...rest,
      text: q.text,
      options: q.options,
      correctIndex: q.correctIndex,
      reference: q.reference,
      topicPath: q.topicPath,
      sourceQuality: q.sourceQuality,
      createdAt: q.createdAt,
    },
  };
}

export function applyMutationsToQuestions(questions: Question[]): Question[] {
  return applyDiskMutations(questions);
}
