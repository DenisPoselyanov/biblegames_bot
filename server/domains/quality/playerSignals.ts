/**
 * Player signals per question (content quality gate, layer 4): open reports
 * and the accuracy band from recorded answers, in the shape `signalBoost()`
 * reads. Used to review reported questions first (`ai-review --signals-first`)
 * and to raise them in the Studio queue.
 */
import { signalBoost } from '../../../src/lib/contentAssessment';
import { bandOf, DEFAULT_MIN_ATTEMPTS } from './analytics';
import type { QualityRepositories } from './repository';
import type { ContentReportGroup, QuestionAccuracy } from './types';

export interface PlayerSignals {
  openReports: number;
  wrongAnswerReports: number;
  accuracyBand: 'too_hard' | 'too_easy' | 'ok' | null;
}

export function playerSignalsByQuestion(
  groups: readonly ContentReportGroup[],
  accuracy: readonly QuestionAccuracy[],
): Map<string, PlayerSignals> {
  const out = new Map<string, PlayerSignals>();
  const get = (id: string): PlayerSignals => {
    let s = out.get(id);
    if (!s) {
      s = { openReports: 0, wrongAnswerReports: 0, accuracyBand: null };
      out.set(id, s);
    }
    return s;
  };
  for (const g of groups) {
    if (g.entityType !== 'question' || g.openCount === 0) continue;
    const s = get(g.entityId);
    s.openReports += g.openCount;
    s.wrongAnswerReports += g.categories.wrong_answer ?? 0;
  }
  for (const a of accuracy) {
    if (a.attempts <= 0) continue;
    const band = bandOf(a.correct / a.attempts);
    get(a.questionId).accuracyBand = band === 'too_hard' || band === 'too_easy' ? band : 'ok';
  }
  return out;
}

/** Signals for every question that has any, from the live quality repositories. */
export async function loadPlayerSignals(quality: QualityRepositories): Promise<Map<string, PlayerSignals>> {
  const [groups, accuracy] = await Promise.all([
    quality.reports.listGroups({ limit: 500 }),
    quality.signals.accuracy({ minAttempts: DEFAULT_MIN_ATTEMPTS }),
  ]);
  return playerSignalsByQuestion(groups, accuracy);
}

export function boostFor(signals: Map<string, PlayerSignals>, questionId: string): number {
  const s = signals.get(questionId);
  return s ? signalBoost(s) : 0;
}
