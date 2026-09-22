/**
 * Scripture reference verification (Phase 4 WS4, spec §5.4/§6.3).
 *
 * "Do not claim a quotation is exact if it is paraphrased" — the whole point
 * of `verifyScriptureReference` is that its computed `verdict` is independent
 * of whatever the author claims (a lesson `scripture` block's `isParaphrase`
 * flag, or the mere absence of any accuracy claim on a question). A reviewer
 * comparing the author's claim against the computed verdict is exactly how a
 * "claims exact, is actually paraphrased" bug gets caught.
 */
import { parseBibleReference } from '../../../src/lib/bibleReference';
import type { ScriptureSourceAdapter } from './scriptureSourceAdapter';

export type ScriptureVerdict = 'match' | 'paraphrase' | 'mismatch' | 'not_found';

export interface ScriptureVerificationInput {
  /** As authored — "Ів 3:16", "Івана 3:16", "JHN.3.16", … (one canonical key after parsing). */
  reference: string;
  /**
   * The text the content claims is a quotation of that reference, or `null`
   * when the content only cites the reference without quoting it — then
   * verification can only confirm the reference *exists* (§6.3), verdict is
   * `match`/`not_found` only, `paraphrase`/`mismatch` never apply.
   */
  quotedText: string | null;
  translation: string;
}

export interface ScriptureVerificationResult {
  verdict: ScriptureVerdict;
  reason: 'ok' | 'unparsed_reference' | 'source_unavailable' | 'no_quotation_to_check';
  bookId: number | null;
  chapter: number | null;
  verseStart: number | null;
  verseEnd: number | null;
  /** The fetched canonical text, joined in verse order — `null` when the reference didn't resolve to anything. */
  sourceText: string | null;
  adapterVersion: string;
}

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/['"«»`.,;:!?()\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (s: string): string[] => normalize(s).split(' ').filter(Boolean);

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const PARAPHRASE_THRESHOLD = 0.6;

/** Classify a claimed quotation against the canonical text — exported for direct unit testing. */
export function classifyQuotation(quotedText: string, canonicalText: string): 'match' | 'paraphrase' | 'mismatch' {
  if (normalize(quotedText) === normalize(canonicalText)) return 'match';
  const similarity = jaccard(tokenize(quotedText), tokenize(canonicalText));
  return similarity >= PARAPHRASE_THRESHOLD ? 'paraphrase' : 'mismatch';
}

export async function verifyScriptureReference(
  input: ScriptureVerificationInput,
  adapter: ScriptureSourceAdapter,
): Promise<ScriptureVerificationResult> {
  const parsed = parseBibleReference(input.reference);
  if (!parsed) {
    return {
      verdict: 'not_found',
      reason: 'unparsed_reference',
      bookId: null,
      chapter: null,
      verseStart: null,
      verseEnd: null,
      sourceText: null,
      adapterVersion: adapter.version,
    };
  }

  const rows = await adapter.fetchPassage({
    bookId: parsed.bookId,
    chapter: parsed.chapter,
    verses: parsed.verses,
    translation: input.translation,
  });

  const verseStart = parsed.verses[0] ?? null;
  const verseEnd = parsed.verses[parsed.verses.length - 1] ?? null;

  if (!rows || rows.length === 0) {
    return {
      verdict: 'not_found',
      reason: 'source_unavailable',
      bookId: parsed.bookId,
      chapter: parsed.chapter,
      verseStart,
      verseEnd,
      sourceText: null,
      adapterVersion: adapter.version,
    };
  }

  const sourceText = [...rows]
    .sort((a, b) => a.verse - b.verse)
    .map((r) => r.text)
    .join(' ');

  if (input.quotedText == null) {
    return {
      verdict: 'match',
      reason: 'no_quotation_to_check',
      bookId: parsed.bookId,
      chapter: parsed.chapter,
      verseStart,
      verseEnd,
      sourceText,
      adapterVersion: adapter.version,
    };
  }

  return {
    verdict: classifyQuotation(input.quotedText, sourceText),
    reason: 'ok',
    bookId: parsed.bookId,
    chapter: parsed.chapter,
    verseStart,
    verseEnd,
    sourceText,
    adapterVersion: adapter.version,
  };
}
