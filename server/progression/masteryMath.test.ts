import { describe, expect, it } from 'vitest';
import { updateMastery as clientUpdateMastery } from '../../src/lib/learning';
import { updateMastery, MASTERY_EXPERT_THRESHOLD } from './masteryMath';
import type { MasteryState } from '../../src/types/index';

/** Drives both implementations through the same answer sequence and compares. */
function run(seq: boolean[]): MasteryState {
  let state: MasteryState | undefined;
  for (const correct of seq) {
    state = updateMastery(state, correct, 'knowledge-gap');
  }
  return state!;
}

function runClient(seq: boolean[]): MasteryState {
  let state: MasteryState | undefined;
  for (const correct of seq) {
    state = clientUpdateMastery(state, correct, 'knowledge-gap');
  }
  return state!;
}

describe('server updateMastery — port fidelity', () => {
  const sequences: boolean[][] = [
    [true],
    [false],
    [true, true, true, true, true, true, true, true],
    [true, false, true, false, true],
    [false, false, false, true, true],
  ];

  for (const seq of sequences) {
    it(`matches the client for [${seq.map((b) => (b ? 'c' : 'w')).join('')}]`, () => {
      const server = run(seq);
      const client = runClient(seq);
      expect(server.mastery).toBe(client.mastery);
      expect(server.confidence).toBe(client.confidence);
      expect(server.correctStreak).toBe(client.correctStreak);
      expect(server.wrongCount).toBe(client.wrongCount);
      expect(server.totalAnswers).toBe(client.totalAnswers);
      expect(server.errorTags).toEqual(client.errorTags);
    });
  }

  it('caps mastery at 100 and only then qualifies for mastery-expert', () => {
    const maxed = run(Array(30).fill(true));
    expect(maxed.mastery).toBe(100);
    expect(maxed.mastery).toBeGreaterThanOrEqual(MASTERY_EXPERT_THRESHOLD);

    const oneCorrect = run([true]);
    expect(oneCorrect.mastery).toBeLessThan(MASTERY_EXPERT_THRESHOLD);
  });
});
