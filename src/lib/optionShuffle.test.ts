import { describe, expect, it } from 'vitest';
import {
  buildOptionOrder,
  isPinnedOption,
  shuffleQuestionOptions,
  toCanonicalIndex,
  toDisplayIndex,
} from './optionShuffle';

const question = {
  id: 'q1',
  options: ['Червоне', 'Мертве', 'Галилейське', 'Середземне'],
  correctIndex: 0,
};

describe('optionShuffle — render-time answer shuffle (content quality gate)', () => {
  it('is a permutation, and correctIndex still points at the same answer', () => {
    for (let s = 0; s < 50; s++) {
      const shuffled = shuffleQuestionOptions(question, `run-${s}`);
      expect([...shuffled.optionOrder].sort()).toEqual([0, 1, 2, 3]);
      expect(shuffled.options[shuffled.correctIndex]).toBe('Червоне');
      shuffled.options.forEach((opt, i) => {
        expect(question.options[toCanonicalIndex(shuffled.optionOrder, i)]).toBe(opt);
      });
    }
  });

  it('is deterministic per seed and does not mutate the source', () => {
    const a = shuffleQuestionOptions(question, 'same');
    const b = shuffleQuestionOptions(question, 'same');
    expect(a.options).toEqual(b.options);
    expect(question.options[0]).toBe('Червоне');
    expect(question.correctIndex).toBe(0);
  });

  it('spreads an always-A answer roughly evenly across positions', () => {
    const counts = [0, 0, 0, 0];
    const runs = 4000;
    for (let s = 0; s < runs; s++) counts[shuffleQuestionOptions(question, `s${s}`).correctIndex] += 1;
    for (const c of counts) {
      expect(c / runs).toBeGreaterThan(0.2);
      expect(c / runs).toBeLessThan(0.3);
    }
  });

  it('keeps aggregate options ("Усі перелічені", "Жоден з них") in place', () => {
    const options = ['Срібло та золото', 'Дружину ближнього', 'Волів або ослів', 'Все перелічене'];
    for (let s = 0; s < 30; s++) {
      expect(buildOptionOrder(options, `x${s}`)[3]).toBe(3);
    }
    expect(isPinnedOption('Жоден з них')).toBe(true);
    expect(isPinnedOption('Усі варіанти правильні')).toBe(true);
    expect(isPinnedOption('Обидва батьки були юдеями')).toBe(false);
    expect(isPinnedOption('Жоден не залишився')).toBe(false);
  });

  it('maps display ↔ canonical indexes, leaving "no answer" (-1) untouched', () => {
    const order = [2, 0, 3, 1];
    expect(toCanonicalIndex(order, 0)).toBe(2);
    expect(toDisplayIndex(order, 2)).toBe(0);
    expect(toCanonicalIndex(order, -1)).toBe(-1);
  });
});
