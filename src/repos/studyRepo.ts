import type { AnswerEvent, StudyPath, StudySession, StudyMode } from '../types';
import { STUDY_THEME_GROUPS } from '../data/study_themes';
import { apiV1Fetch, hasApi } from './apiClient';

/**
 * Answer history is server-owned: `useProgression().recordAnswerEvent` sends the
 * mastery command (`POST /api/v1/progression/answers`), which also persists the
 * history row. This repo keeps a local mirror for offline reads and derives the
 * study path from it (WS4 part 2 removed the legacy `/study/answer` +
 * `/study/answers/:userId` endpoints).
 */

const ANSWERS_KEY = 'bible-game-answer-events';

let answerHistoryCache: AnswerEvent[] | null = null;

function loadAnswers(): AnswerEvent[] {
  if (answerHistoryCache) return answerHistoryCache;
  try {
    answerHistoryCache = JSON.parse(localStorage.getItem(ANSWERS_KEY) ?? '[]') as AnswerEvent[];
    return answerHistoryCache;
  } catch {
    answerHistoryCache = [];
    return answerHistoryCache;
  }
}

function saveAnswers(items: AnswerEvent[]): void {
  answerHistoryCache = items.slice(-2000);
  localStorage.setItem(ANSWERS_KEY, JSON.stringify(answerHistoryCache));
}

function scoreSubthemePriority(subthemeId: string, answers: AnswerEvent[]): number {
  const filtered = answers.filter((a) => a.subthemeId === subthemeId);
  if (filtered.length === 0) return 100;
  const correct = filtered.filter((a) => a.isCorrect).length;
  const accuracy = correct / filtered.length;
  const freshnessPenalty = Math.min(30, filtered.length < 4 ? 20 : 0);
  return Math.round((1 - accuracy) * 100 + freshnessPenalty);
}

export const studyRepo = {
  startSession(userId: string, mode: StudyMode, subthemeId: string): StudySession {
    return {
      id: `study-${Date.now()}`,
      userId,
      mode,
      subthemeId,
      startedAt: new Date().toISOString(),
      answers: [],
    };
  },
  appendAnswer(event: AnswerEvent): void {
    const list = loadAnswers();
    list.push(event);
    saveAnswers(list);
  },
  getAnswerHistory(): AnswerEvent[] {
    return loadAnswers();
  },
  async syncHistory(): Promise<void> {
    if (!hasApi()) return;
    try {
      const response = await apiV1Fetch('/me/study/answers');
      if (!response.ok) return;
      const remote = (await response.json()) as AnswerEvent[];
      const map = new Map<string, AnswerEvent>();
      [...remote, ...loadAnswers()].forEach((item) => {
        map.set(`${item.questionId}-${item.answeredAt}-${item.subthemeId}`, item);
      });
      saveAnswers([...map.values()].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt)));
    } catch {
      /* noop */
    }
  },
  getStudyPath(): StudyPath {
    const answers = loadAnswers();
    const subthemes = STUDY_THEME_GROUPS.flatMap((g) => g.subthemes);
    const nodes = subthemes
      .map((s) => {
        const priority = scoreSubthemePriority(s.id, answers);
        const reason = priority > 70 ? 'weakness' : answers.some((a) => a.subthemeId === s.id) ? 'scheduled-review' : 'new';
        return { subthemeId: s.id, priority, reason } as const;
      })
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 6);
    return { generatedAt: new Date().toISOString(), nodes };
  },
};
