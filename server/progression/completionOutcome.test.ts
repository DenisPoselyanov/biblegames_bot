import { describe, expect, it } from 'vitest';
import { AppError } from '../lib/errors';
import {
  computeCompletion,
  snapshotFromProfile,
  type CompletionAnswer,
  type CompletionInput,
  type QuestionLookup,
} from './completionOutcome';
import { emptyProfile } from '../services/profileService';
import type { Difficulty } from '../../src/types/index';

const base = () => snapshotFromProfile(emptyProfile('u1'));

/** A `QuestionLookup` stub backed by a fixed answer key, for millionaire/survival tests. */
function questionsFixture(
  entries: Array<{ id: string; correctIndex: number; difficulty: Difficulty }>,
): QuestionLookup {
  const byId = new Map(entries.map((q) => [q.id, q]));
  return async (ids) => ids.map((id) => byId.get(id)).filter((q): q is (typeof entries)[number] => !!q);
}

/** Builds an all-correct millionaire/survival answer trail against a fixture. */
function correctAnswers(
  entries: Array<{ id: string; correctIndex: number }>,
): CompletionAnswer[] {
  return entries.map((q) => ({ questionId: q.id, selectedIndex: q.correctIndex }));
}

describe('computeCompletion — level', () => {
  it('awards DIFFICULTY_POINTS * accuracy and records the level', async () => {
    const res = await computeCompletion(
      { kind: 'level', difficulty: 'child', themeId: 'gospels', correctCount: 7, totalQuestions: 7 },
      base(),
    );
    expect(res.delta.coins).toBe(15); // child = 15, perfect accuracy
    expect(res.next.coins).toBe(15);
    expect(res.next.completedLevels).toHaveLength(1);
    expect(res.delta.achievementsGranted).toContain('flawless-level');
  });

  it('caps at DIFFICULTY_POINTS and rounds by accuracy', async () => {
    const res = await computeCompletion(
      { kind: 'level', difficulty: 'youth', themeId: 't', correctCount: 3, totalQuestions: 6 },
      base(),
    );
    expect(res.delta.coins).toBe(15); // youth 30 * 0.5
  });

  it('rejects correctCount > totalQuestions', async () => {
    await expect(
      computeCompletion(
        { kind: 'level', difficulty: 'child', themeId: 't', correctCount: 9, totalQuestions: 7 },
        base(),
      ),
    ).rejects.toThrow(AppError);
  });

  it('rejects an unknown difficulty', async () => {
    await expect(
      computeCompletion(
        { kind: 'level', difficulty: 'wizard', themeId: 't', correctCount: 1, totalQuestions: 1 } as CompletionInput,
        base(),
      ),
    ).rejects.toThrow(/difficulty/);
  });
});

describe('computeCompletion — practice_stage', () => {
  it('grants wisdom and advances rank on a pass', async () => {
    const res = await computeCompletion(
      { kind: 'practice_stage', difficulty: 'child', themeId: 't', correctCount: 10, totalQuestions: 10 },
      base(),
    );
    expect(res.delta.wisdom).toBe(12); // child base 8 * 1.5 perfect bonus
    expect(res.next.wisdom).toBe(12); // below the 20 plaque threshold, no rank change
    expect(res.delta.rankChanged).toBe(false);
    expect(res.delta.coins).toBe(15);
  });

  it('grants nothing on a fail (< 7 correct)', async () => {
    const res = await computeCompletion(
      { kind: 'practice_stage', difficulty: 'child', themeId: 't', correctCount: 3, totalQuestions: 10 },
      base(),
    );
    expect(res.delta.coins).toBe(0);
    expect(res.delta.wisdom).toBe(0);
  });
});

describe('computeCompletion — practice_stage track derivation', () => {
  it('records a stage result and unlocks the next stage on a pass', async () => {
    const res = await computeCompletion(
      {
        kind: 'practice_stage',
        difficulty: 'child',
        themeId: 't',
        nodeId: 'n1',
        stageIndex: 0,
        correctCount: 8,
        totalQuestions: 10,
      },
      base(),
    );
    expect(res.next.practiceTracks).toHaveLength(1);
    const track = res.next.practiceTracks[0];
    expect(track.highestUnlockedStage).toBe(1);
    expect(track.stageResults[0]).toMatchObject({ stageIndex: 0, passed: true, attempts: 1 });
    expect(res.delta.nextStageUnlocked).toBe(true);
    expect(res.delta.passed).toBe(true);
  });

  it('re-running an already-aced stage grants 0 coins and 0 wisdom', async () => {
    const first = await computeCompletion(
      { kind: 'practice_stage', difficulty: 'child', themeId: 't', nodeId: 'n1', stageIndex: 0, correctCount: 10, totalQuestions: 10 },
      base(),
    );
    expect(first.delta.coins).toBeGreaterThan(0);
    expect(first.delta.wisdom).toBeGreaterThan(0);

    const replay = await computeCompletion(
      { kind: 'practice_stage', difficulty: 'child', themeId: 't', nodeId: 'n1', stageIndex: 0, correctCount: 10, totalQuestions: 10 },
      first.next,
    );
    expect(replay.delta.coins).toBe(0);
    expect(replay.delta.wisdom).toBe(0);
    expect(replay.next.practiceTracks[0].stageResults[0].attempts).toBe(2);
  });

  it('a failed stage does not unlock the next one', async () => {
    const res = await computeCompletion(
      { kind: 'practice_stage', difficulty: 'child', themeId: 't', nodeId: 'n1', stageIndex: 0, correctCount: 3, totalQuestions: 10 },
      base(),
    );
    expect(res.next.practiceTracks[0].highestUnlockedStage).toBe(0);
    expect(res.delta.nextStageUnlocked).toBe(false);
  });
});

describe('computeCompletion — millionaire & survival', () => {
  const millionaireLevels = Array.from({ length: 15 }, (_, i) => ({
    id: `lvl${i + 1}`,
    correctIndex: 0,
    difficulty: 'child' as Difficulty,
  }));
  const millionaireLookup = questionsFixture(millionaireLevels);

  it('millionaire awards per level + a win bonus when the run is finished', async () => {
    const res = await computeCompletion(
      { kind: 'millionaire', answers: correctAnswers(millionaireLevels) },
      base(),
      new Date(),
      millionaireLookup,
    );
    expect(res.delta.coins).toBe(120 + 150); // level 15 prize + win bonus
    expect(res.next.millionaireWins).toBe(1);
    expect(res.next.millionaireMaxLevel).toBe(15);
    expect(res.delta.achievementsGranted).toContain('biblical-millionaire');
  });

  it('millionaire loss falls back to the nearest safe level, not the full run', async () => {
    const answers = [
      ...correctAnswers(millionaireLevels.slice(0, 4)),
      { questionId: 'lvl5', selectedIndex: 3 }, // wrong on level 5
    ];
    const res = await computeCompletion(
      { kind: 'millionaire', answers },
      base(),
      new Date(),
      millionaireLookup,
    );
    expect(res.next.millionaireMaxLevel).toBe(4);
    expect(res.delta.coins).toBe(0); // no safe haven reached yet (safe levels are 5, 10)
    expect(res.delta.achievementsGranted).not.toContain('biblical-millionaire');
  });

  it('millionaire cannot claim a level it never answered correctly', async () => {
    // A client that used to just POST `{ reachedLevel: 10 }` can no longer
    // collect the reward without a validated answer trail proving it (WS9, §15.2).
    const answers = [{ questionId: 'lvl1', selectedIndex: 3 }]; // wrong on the first level
    const res = await computeCompletion(
      { kind: 'millionaire', answers },
      base(),
      new Date(),
      millionaireLookup,
    );
    expect(res.next.millionaireMaxLevel).toBe(0);
    expect(res.delta.coins).toBe(0);
  });

  it('millionaire banking early (no wrong answer submitted) pays the full reached level, no win bonus', async () => {
    const res = await computeCompletion(
      { kind: 'millionaire', answers: correctAnswers(millionaireLevels.slice(0, 10)) },
      base(),
      new Date(),
      millionaireLookup,
    );
    expect(res.delta.coins).toBe(16); // level 10 prize, no win bonus
    expect(res.next.millionaireWins).toBe(0);
  });

  const survivalQuestions = [
    { id: 'q1', correctIndex: 0, difficulty: 'child' as Difficulty },
    { id: 'q2', correctIndex: 0, difficulty: 'child' as Difficulty },
    { id: 'q3', correctIndex: 0, difficulty: 'child' as Difficulty },
  ];
  const survivalLookup = questionsFixture(survivalQuestions);

  it('survival grants iron-shield at 30+ correct and not below', async () => {
    const thirtyCorrect = Array.from({ length: 30 }, (_, i) => ({
      id: `s${i}`,
      correctIndex: 0,
      difficulty: 'baby' as Difficulty,
    }));
    const lookup = questionsFixture(thirtyCorrect);
    const res = await computeCompletion(
      { kind: 'survival', answers: correctAnswers(thirtyCorrect) },
      base(),
      new Date(),
      lookup,
    );
    expect(res.delta.achievementsGranted).toContain('iron-shield');

    const twentyNine = thirtyCorrect.slice(0, 29);
    const res2 = await computeCompletion(
      { kind: 'survival', answers: correctAnswers(twentyNine) },
      base(),
      new Date(),
      lookup,
    );
    expect(res2.delta.achievementsGranted).not.toContain('iron-shield');
  });

  it('survival stops counting after the 3rd wrong answer (lives exhausted)', async () => {
    const answers: CompletionAnswer[] = [
      { questionId: 'q1', selectedIndex: 0 }, // correct, score=1
      { questionId: 'q2', selectedIndex: 3 }, // wrong, lives 3->2
      { questionId: 'q3', selectedIndex: 3 }, // wrong, lives 2->1
      { questionId: 'q1', selectedIndex: 3 }, // wrong, lives 1->0, game over
      // client claims another win after this, but lives are already exhausted server-side
      { questionId: 'q1', selectedIndex: 0 },
    ];
    const res = await computeCompletion({ kind: 'survival', answers }, base(), new Date(), survivalLookup);
    expect(res.next.survivalHighScore).toBe(1); // only the first correct answer counts
  });

  it('survival cannot claim a score without a validated answer trail', async () => {
    // A client that used to just POST `{ score: 5000 }` can no longer collect
    // the reward without answers proving it happened (WS9, §15.3).
    await expect(computeCompletion({ kind: 'survival' }, base())).rejects.toThrow(AppError);
  });
});

describe('streak', () => {
  it('recomputes the streak server-side (ignores client streakDays)', async () => {
    const yesterday = new Date('2026-01-01T12:00:00Z');
    const today = new Date('2026-01-02T12:00:00Z');
    const current = { ...base(), streakDays: 999, lastActiveAt: yesterday.toISOString() };
    const lookup = questionsFixture([{ id: 'q1', correctIndex: 0, difficulty: 'baby' }]);
    const res = await computeCompletion(
      { kind: 'survival', answers: [{ questionId: 'q1', selectedIndex: 0 }] },
      current,
      today,
      lookup,
    );
    expect(res.next.streakDays).toBe(1000); // 999 + 1, not the client's 999
  });
});
