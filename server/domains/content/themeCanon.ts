/**
 * Which Bible books a theme's questions are expected to cite (content quality
 * gate, layer 1). Book ids are the 1–66 Protestant order used by
 * `src/lib/bibleReference.ts`.
 *
 * `primary` — the theme's own books. `secondary` — legitimate cross-references
 * (Samuel/Kings narratives for the prophets theme, Acts for Paul, Jesus'
 * teaching on the commandments). Anything else is `outside`: in the legacy
 * bank that bucket mixes misfiled questions and hallucinations, so it becomes a
 * reviewer-facing finding — never an automatic reject.
 */

const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const OLD_TESTAMENT = range(1, 39);
const NEW_TESTAMENT = range(40, 66);
const GOSPELS = range(40, 43);
const ACTS = 44;

export interface ThemeCanon {
  primary: readonly number[];
  secondary: readonly number[];
}

export const THEME_CANON: Readonly<Record<string, ThemeCanon>> = {
  'old-testament': { primary: OLD_TESTAMENT, secondary: [] },
  pentateuch: { primary: range(1, 5), secondary: [] },
  patriarchs: { primary: [1], secondary: [] },
  judges: { primary: range(6, 8), secondary: [9] },
  kings: { primary: range(9, 14), secondary: range(15, 22) },
  // David's psalms and Solomon's wisdom are narrated in Samuel–Kings/Chronicles.
  'wisdom-poetry': { primary: range(18, 22), secondary: range(9, 14) },
  prophets: { primary: range(23, 39), secondary: range(9, 14) },
  commandments: { primary: [2, 3, 5], secondary: [...GOSPELS, ...range(45, 66)] },
  geography: { primary: OLD_TESTAMENT, secondary: [] },
  'new-testament': { primary: NEW_TESTAMENT, secondary: [] },
  gospels: { primary: GOSPELS, secondary: [] },
  // Luke wrote Acts; the letters (Paul's, James at the Jerusalem council) are to the churches Acts founds.
  acts: { primary: [ACTS], secondary: [42, ...range(45, 57), 59] },
  paul: { primary: range(45, 57), secondary: [ACTS] },
  // Hebrews argues from the Old Testament throughout (Melchizedek, the tabernacle, the heroes of faith).
  'general-epistles': { primary: range(58, 65), secondary: OLD_TESTAMENT },
  revelation: { primary: [66], secondary: [27] },
  'geography-nt': { primary: NEW_TESTAMENT, secondary: [] },
  parables: { primary: GOSPELS, secondary: [] },
  miracles: { primary: GOSPELS, secondary: [ACTS] },
};

export type CanonFit = 'primary' | 'secondary' | 'outside' | 'unknown_theme';

/** The best fit of any cited book — a question citing one primary book fits, whatever else it cites. */
export function canonFit(themeId: string, bookIds: readonly number[]): CanonFit {
  const canon = THEME_CANON[themeId];
  if (!canon) return 'unknown_theme';
  if (bookIds.some((b) => canon.primary.includes(b))) return 'primary';
  if (bookIds.some((b) => canon.secondary.includes(b))) return 'secondary';
  return 'outside';
}
