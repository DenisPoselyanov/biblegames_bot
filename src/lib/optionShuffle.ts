/**
 * Render-time answer-option shuffle (content quality gate, owner decision 2026-09-23).
 *
 * The stored bank is position-biased (embedded questions always put the answer at A,
 * the AI bank favours B), so players can win by position. Options are shuffled for
 * display only; the stored `correctIndex` stays canonical.
 *
 * `optionOrder[displayIndex] = canonicalIndex`. Anything sent to the server (answer
 * trails graded against the canonical key) must go through `toCanonicalIndex`.
 *
 * Aggregate options ("Усі перелічені", "Жоден з них") refer to the other options and
 * are conventionally last, so they keep their position; the rest are shuffled.
 */

const PINNED_OPTION_PATTERNS: readonly RegExp[] = [
  /^(усі|всі|все|усе)\s+(перелічен|вищеперелічен|вищезазначен|наведен|варіант|відповід|вище|зазначен)/i,
  /^(жоден|жодна|жодне|жодні|нічого)\s+(з|із)(\s|$)/i,
];

export function isPinnedOption(option: string): boolean {
  const text = option.trim();
  return PINNED_OPTION_PATTERNS.some((re) => re.test(text));
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic for a given seed, so re-renders and reconnects keep the same order. */
export function buildOptionOrder(options: readonly string[], seed: string): number[] {
  const order = options.map((_, i) => i);
  const movable = order.filter((i) => !isPinnedOption(options[i]));
  let state = hashSeed(seed) || 1;
  for (let i = movable.length - 1; i > 0; i--) {
    state = hashSeed(`${state}:${i}`) || 1;
    const j = state % (i + 1);
    [movable[i], movable[j]] = [movable[j], movable[i]];
  }
  let next = 0;
  return order.map((i) => (isPinnedOption(options[i]) ? i : movable[next++]));
}

export function toCanonicalIndex(optionOrder: readonly number[], displayIndex: number): number {
  return optionOrder[displayIndex] ?? displayIndex;
}

export function toDisplayIndex(optionOrder: readonly number[], canonicalIndex: number): number {
  const i = optionOrder.indexOf(canonicalIndex);
  return i === -1 ? canonicalIndex : i;
}

export type ShuffledQuestion<T> = T & { optionOrder: number[] };

/** Copy of `question` with options in display order and `correctIndex` remapped to match. */
export function shuffleQuestionOptions<T extends { id: string; options: string[]; correctIndex: number }>(
  question: T,
  seed: string,
): ShuffledQuestion<T> {
  const optionOrder = buildOptionOrder(question.options, `${seed}:${question.id}`);
  return {
    ...question,
    options: optionOrder.map((i) => question.options[i]),
    correctIndex: toDisplayIndex(optionOrder, question.correctIndex),
    optionOrder,
  };
}

/** Fresh per-run salt: a new game shows a new order; one run stays stable. */
export function newShuffleSalt(): string {
  return Math.random().toString(36).slice(2, 10);
}
