import type { AnswerEvent, StudyPath, StudySession, StudyMode } from '../types';
import { STUDY_THEME_GROUPS } from '../data/study_themes';
import { apiFetch, apiV1Fetch, hasApi } from './apiClient';
import { isFeatureEnabled } from '../lib/flags';

function isAuthoritative(): boolean {
  return hasApi() && isFeatureEnabled('authoritative_profile');
}

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
  async appendAnswer(event: AnswerEvent, userId?: string): Promise<void> {
    const list = loadAnswers();
    list.push(event);
    saveAnswers(list);
    // Authoritative mode: PlayerContext.recordAnswerEvent sends the mastery
    // command (POST /api/v1/progression/answers), which also stores history.
    if (isAuthoritative()) return;
    if (!hasApi() || !userId) return;
    try {
      await apiFetch('/study/answer', userId, {
        method: 'POST',
        body: JSON.stringify(event),
      });
    } catch {
      /* noop */
    }
  },
  getAnswerHistory(): AnswerEvent[] {
    return loadAnswers();
  },
  async syncHistory(userId: string): Promise<void> {
    if (!hasApi()) return;

    if (isAuthoritative()) {
      // Read-only: the server owns the answer history (written by the mastery
      // command). Merge remote into local for offline read consumers.
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
      return;
    }

    try {
      const response = await apiFetch(`/study/answers/${userId}`, userId);
      if (!response.ok) return;
      const remote = (await response.json()) as AnswerEvent[];
      const local = loadAnswers();
      const map = new Map<string, AnswerEvent>();
      [...remote, ...local].forEach((item) => {
        const key = `${item.questionId}-${item.answeredAt}-${item.subthemeId}`;
        map.set(key, item);
      });
      const merged = [...map.values()].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt));
      saveAnswers(merged);
      await apiFetch(`/study/answers/${userId}`, userId, {
        method: 'PUT',
        body: JSON.stringify(merged),
      });
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
