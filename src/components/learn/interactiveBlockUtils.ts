/**
 * Pure helpers for the interactive lesson blocks. Shuffles are seeded by the
 * block id so a block renders in the same order on every render and resume,
 * yet never in the authored (= correct) order.
 */

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic Fisher-Yates permutation of `0..length-1` for `seed`. For
 * `length >= 2` the result is never the identity — an "order these" task that
 * starts already solved would be pointless.
 */
export function seededPermutation(length: number, seed: string): number[] {
  const order = Array.from({ length }, (_, i) => i);
  const rand = mulberry32(hashSeed(seed));
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (length >= 2 && order.every((v, i) => v === i)) order.push(order.shift()!);
  return order;
}

export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  return seededPermutation(items.length, seed).map((i) => items[i]);
}

/** Number of hide-rounds `memory_verse` steps through: 0 = full verse … last = every word hidden. */
export const MEMORY_VERSE_ROUNDS = 4;

/**
 * Which word indices are hidden in `round` (0-based). Each round hides a
 * larger share of the words (0 → ⅓ → ⅔ → all), and a word hidden in one
 * round stays hidden in every later one, so the verse fades out gradually.
 * Punctuation-only tokens are never hidden.
 */
export function hiddenWordIndices(words: readonly string[], round: number, seed: string): Set<number> {
  const hideable = words.map((w, i) => (/[\p{L}\p{N}]/u.test(w) ? i : -1)).filter((i) => i >= 0);
  const order = seededShuffle(hideable, seed);
  const share = Math.min(Math.max(round, 0), MEMORY_VERSE_ROUNDS - 1) / (MEMORY_VERSE_ROUNDS - 1);
  return new Set(order.slice(0, Math.round(order.length * share)));
}
