/**
 * Deterministic `ScriptureSourceAdapter` for tests (Phase 4 WS4, mirrors the
 * §7.4 `MockAiProvider` pattern). No network — a fixed verse-text fixture
 * keyed by `bookId:chapter:verse`, so `not_found` is reproducible by simply
 * not seeding a verse.
 */
import type {
  ScripturePassageLookup,
  ScriptureSourceAdapter,
  ScriptureVerseRow,
} from '../../domains/content/scriptureSourceAdapter';

export interface MockScriptureFixtureVerse {
  bookId: number;
  chapter: number;
  verse: number;
  text: string;
}

const fixtureKey = (bookId: number, chapter: number, verse: number): string =>
  `${bookId}:${chapter}:${verse}`;

export function createMockScriptureSourceAdapter(
  fixtures: MockScriptureFixtureVerse[] = [],
  version = 'mock-scripture-v1',
): ScriptureSourceAdapter {
  const byKey = new Map(fixtures.map((f) => [fixtureKey(f.bookId, f.chapter, f.verse), f.text]));

  return {
    version,
    async fetchPassage(lookup: ScripturePassageLookup): Promise<ScriptureVerseRow[] | null> {
      const rows: ScriptureVerseRow[] = [];
      for (const verse of lookup.verses) {
        const text = byKey.get(fixtureKey(lookup.bookId, lookup.chapter, verse));
        if (text != null) rows.push({ verse, text });
      }
      return rows.length > 0 ? rows : null;
    },
  };
}
