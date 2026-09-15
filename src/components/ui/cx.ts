export type ClassValue = string | false | null | undefined;

/** Tiny classNames joiner — avoids pulling in `clsx` for a one-line need. */
export function cx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
