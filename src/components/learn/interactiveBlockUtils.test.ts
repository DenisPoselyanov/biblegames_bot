import { describe, expect, it } from 'vitest';
import { hiddenWordIndices, MEMORY_VERSE_ROUNDS, seededPermutation, seededShuffle } from './interactiveBlockUtils';

describe('seededPermutation', () => {
  it('is a permutation and stable for the same seed', () => {
    const a = seededPermutation(6, 'block-1');
    expect([...a].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(seededPermutation(6, 'block-1')).toEqual(a);
  });

  it('never returns the identity order for 2+ items', () => {
    for (let n = 2; n <= 6; n++) {
      for (let s = 0; s < 200; s++) {
        const p = seededPermutation(n, `seed-${s}`);
        expect(p.every((v, i) => v === i), `n=${n} seed-${s}`).toBe(false);
      }
    }
  });

  it('handles empty and single-item lists', () => {
    expect(seededPermutation(0, 'x')).toEqual([]);
    expect(seededPermutation(1, 'x')).toEqual([0]);
  });
});

describe('seededShuffle', () => {
  it('keeps every item', () => {
    expect(seededShuffle(['a', 'b', 'c'], 's').sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('hiddenWordIndices', () => {
  const words = 'Бо так полюбив Бог світ , що дав Сина Свого Єдинородного'.split(' ');

  it('hides nothing in round 0 and every word in the last round', () => {
    expect(hiddenWordIndices(words, 0, 's').size).toBe(0);
    const all = hiddenWordIndices(words, MEMORY_VERSE_ROUNDS - 1, 's');
    expect(all.size).toBe(words.length - 1); // the lone "," is never hidden
    expect(all.has(words.indexOf(','))).toBe(false);
  });

  it('only ever grows from one round to the next', () => {
    for (let r = 1; r < MEMORY_VERSE_ROUNDS; r++) {
      const prev = hiddenWordIndices(words, r - 1, 's');
      const next = hiddenWordIndices(words, r, 's');
      for (const i of prev) expect(next.has(i)).toBe(true);
      expect(next.size).toBeGreaterThanOrEqual(prev.size);
    }
  });
});
