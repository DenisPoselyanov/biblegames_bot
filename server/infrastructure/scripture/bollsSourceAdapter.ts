/**
 * `ScriptureSourceAdapter` backed by bolls.life (Phase 4 WS4) — the same
 * client the Daily Scripture / reader feature already uses
 * (`server/bollsClient.ts`), wired behind the domain's adapter contract
 * instead of called ad hoc.
 */
import { fetchBollsChapter, fetchBollsVerses } from '../../bollsClient';
import { normalizeBollsTranslation } from '../../../src/lib/bollsConstants';
import type {
  ScripturePassageLookup,
  ScriptureSourceAdapter,
  ScriptureVerseRow,
} from '../../domains/content/scriptureSourceAdapter';

export function createBollsSourceAdapter(): ScriptureSourceAdapter {
  return {
    version: 'bolls.life-v1',
    async fetchPassage(lookup: ScripturePassageLookup): Promise<ScriptureVerseRow[] | null> {
      const translation = normalizeBollsTranslation(lookup.translation);
      try {
        let rows = await fetchBollsVerses(translation, lookup.bookId, lookup.chapter, lookup.verses);
        if (rows.length === 0) {
          const chapterRows = await fetchBollsChapter(translation, lookup.bookId, lookup.chapter);
          const wanted = new Set(lookup.verses);
          rows = chapterRows.filter((r) => wanted.has(r.verse));
        }
        if (rows.length === 0) return null;
        return rows.map((r) => ({ verse: r.verse, text: r.text }));
      } catch {
        return null;
      }
    },
  };
}
