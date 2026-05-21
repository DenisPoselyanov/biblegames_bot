import type { AnswerEvent, DailyTask, LearningInsight, MasteryState, PlayerProfile } from '../types';

export function updateStreak(profile: PlayerProfile): PlayerProfile {
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const last = profile.lastActiveAt ? new Date(profile.lastActiveAt) : null;
  if (!last) {
    return { ...profile, streakDays: 1, lastActiveAt: today.toISOString() };
  }
  const lastDate = new Date(last.getFullYear(), last.getMonth(), last.getDate());
  const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / 86400000);
  if (diffDays <= 0) return profile;
  if (diffDays === 1) return { ...profile, streakDays: profile.streakDays + 1, lastActiveAt: today.toISOString() };
  return { ...profile, streakDays: 1, lastActiveAt: today.toISOString() };
}

export function updateMastery(state: MasteryState | undefined, isCorrect: boolean, tag: string): MasteryState {
  const current = state ?? {
    mastery: 0,
    confidence: 0,
    lastReviewedAt: null,
    errorTags: [],
    correctStreak: 0,
    wrongCount: 0,
    totalAnswers: 0,
  };
  const nextStreak = isCorrect ? current.correctStreak + 1 : 0;
  const total = current.totalAnswers + 1;
  const wrongCount = current.wrongCount + (isCorrect ? 0 : 1);
  const delta = isCorrect ? 6 + Math.min(6, nextStreak) : -10;
  const mastery = Math.max(0, Math.min(100, current.mastery + delta));
  const confidence = Math.max(0, Math.min(100, Math.round((1 - wrongCount / total) * 100)));
  return {
    mastery,
    confidence,
    lastReviewedAt: new Date().toISOString(),
    errorTags: isCorrect ? current.errorTags : Array.from(new Set([...current.errorTags, tag])),
    correctStreak: nextStreak,
    wrongCount,
    totalAnswers: total,
  };
}

export function getDailyTasks(_profile: PlayerProfile, answerHistory: AnswerEvent[]): DailyTask[] {
  const today = new Date().toISOString().slice(0, 10);
  const todayAnswers = answerHistory.filter((a) => a.answeredAt.startsWith(today));
  const correctToday = todayAnswers.filter((a) => a.isCorrect).length;
  const reviewedToday = new Set(todayAnswers.map((a) => a.subthemeId)).size;
  return [
    { id: 'daily-levels', title: 'Пройти 2 рівні в Дослідженні', goal: 2, progress: Math.min(2, Math.floor(todayAnswers.length / 7)), completed: Math.floor(todayAnswers.length / 7) >= 2 },
    { id: 'daily-correct', title: 'Дати 10 правильних відповідей', goal: 10, progress: Math.min(10, correctToday), completed: correctToday >= 10 },
    { id: 'daily-review', title: 'Повторити 3 підтеми', goal: 3, progress: Math.min(3, reviewedToday), completed: reviewedToday >= 3 },
  ];
}

export function buildLearningInsight(profile: PlayerProfile, answers: AnswerEvent[]): LearningInsight {
  const now = Date.now();
  const days = (n: number) => now - n * 86400000;
  const recent7 = answers.filter((a) => new Date(a.answeredAt).getTime() >= days(7));
  const recent30 = answers.filter((a) => new Date(a.answeredAt).getTime() >= days(30));
  const accuracy7d = recent7.length ? Math.round((recent7.filter((a) => a.isCorrect).length / recent7.length) * 100) : 0;
  const accuracy30d = recent30.length ? Math.round((recent30.filter((a) => a.isCorrect).length / recent30.length) * 100) : 0;
  const masteredSubthemes = Object.values(profile.studyMastery).filter((m) => m.mastery >= 80).length;
  return { masteredSubthemes, accuracy7d, accuracy30d, retention24h: profile.streakDays >= 2 ? 100 : 0, retention72h: profile.streakDays >= 4 ? 100 : 0 };
}
