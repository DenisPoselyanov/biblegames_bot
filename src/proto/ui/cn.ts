/** Tiny class-name joiner — kept out of `kit.tsx` so that file only exports components. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
