import {
  BOLLS_TRANSLATION_LABELS,
  type BollsTranslation,
  isBollsTranslation,
  normalizeBollsTranslation,
} from '../src/lib/bollsConstants';
import { parseBibleReference } from '../src/lib/bibleReference';
import { bollsReaderUrl } from '../src/lib/bollsText';
import type { DailyScripture, ScripturePassage } from '../src/types/scripture';
import { fetchBollsBooks, fetchBollsChapter, fetchBollsVerses, fetchCanonicalRandomVerse } from './bollsClient';
import { cacheGet, cacheSet, dailyCacheKey } from './scriptureCache';

const BOOK_NAMES_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function booksCacheKey(translation: BollsTranslation): string {
  return `books:${translation}`;
}

async function resolveBookName(translation: BollsTranslation, bookId: number): Promise<string> {
  let names = cacheGet<Record<number, string>>(booksCacheKey(translation));
  if (!names) {
    try {
      const books = await fetchBollsBooks(translation);
      names = Object.fromEntries(books.map((book) => [book.bookid, book.name.trim()]));
      cacheSet(booksCacheKey(translation), names, BOOK_NAMES_CACHE_TTL_MS);
    } catch {
      names = {};
    }
  }
  return names[bookId] ?? `Книга ${bookId}`;
}

function formatReference(book: string, chapter: number, verses: number[]): string {
  if (verses.length === 0) return `${book} ${chapter}`;
  const first = verses[0];
  const last = verses[verses.length - 1];
  if (first === last) return `${book} ${chapter}:${first}`;
  return `${book} ${chapter}:${first}-${last}`;
}

export function getScriptureTranslations() {
  return (['HOM', 'UBIO', 'UTT'] as const).map((id) => ({
    id,
    label: BOLLS_TRANSLATION_LABELS[id],
  }));
}

export async function getScripturePassage(
  reference: string,
  translationInput?: string,
): Promise<ScripturePassage> {
  const translation = normalizeBollsTranslation(translationInput);
  const cacheKey = `passage:${translation}:${reference.trim().toLowerCase()}`;
  const cached = cacheGet<ScripturePassage>(cacheKey);
  if (cached) return { ...cached, cached: true };

  const parsed = parseBibleReference(reference);
  if (!parsed) {
    return {
      reference,
      translation,
      translationLabel: BOLLS_TRANSLATION_LABELS[translation],
      bookId: 0,
      chapter: 0,
      verses: [],
      readerUrl: 'https://bolls.life/',
      parseError: 'unparsed_reference',
    };
  }

  let rows;
  try {
    rows = await fetchBollsVerses(translation, parsed.bookId, parsed.chapter, parsed.verses);
    if (rows.length === 0) {
      const chapterRows = await fetchBollsChapter(translation, parsed.bookId, parsed.chapter);
      const wanted = new Set(parsed.verses);
      rows = chapterRows.filter((r) => wanted.has(r.verse));
    }
  } catch {
    return {
      reference: parsed.raw,
      translation,
      translationLabel: BOLLS_TRANSLATION_LABELS[translation],
      bookId: parsed.bookId,
      chapter: parsed.chapter,
      verses: [],
      readerUrl: bollsReaderUrl(translation, parsed.bookId, parsed.chapter, parsed.verses[0]),
      parseError: 'bolls_unavailable',
    };
  }

  const passage: ScripturePassage = {
    reference: parsed.raw,
    translation,
    translationLabel: BOLLS_TRANSLATION_LABELS[translation],
    bookId: parsed.bookId,
    chapter: parsed.chapter,
    verses: rows.map((r) => ({ verse: r.verse, text: r.text })),
    readerUrl: bollsReaderUrl(translation, parsed.bookId, parsed.chapter, parsed.verses[0]),
  };

  if (passage.verses.length > 0) {
    cacheSet(cacheKey, passage);
  }

  return passage;
}

export async function getDailyScripture(translationInput?: string): Promise<DailyScripture> {
  const translation = normalizeBollsTranslation(translationInput);
  const date = new Date().toISOString().slice(0, 10);
  const cacheKey = dailyCacheKey(translation, date);
  const cached = cacheGet<DailyScripture>(cacheKey);
  if (cached) return cached;

  try {
    const row = await fetchCanonicalRandomVerse(translation);
    const bookName = await resolveBookName(translation, row.book);
    const daily: DailyScripture = {
      translation,
      translationLabel: BOLLS_TRANSLATION_LABELS[translation],
      bookId: row.book,
      chapter: row.chapter,
      verse: row.verse,
      reference: formatReference(bookName, row.chapter, [row.verse]),
      text: row.text,
      readerUrl: bollsReaderUrl(translation, row.book, row.chapter, row.verse),
      date,
    };
    cacheSet(cacheKey, daily, 25 * 60 * 60 * 1000);
    return daily;
  } catch {
    const fallback: DailyScripture = {
      translation,
      translationLabel: BOLLS_TRANSLATION_LABELS[translation],
      bookId: 43,
      chapter: 3,
      verse: 16,
      reference: 'Івана 3:16',
      text: 'Бо так полюбив Бог світ, що Сина Свого Однородженого дав, щоб кожен, хто вірує в Нього, не загинув, але мав життя вічне.',
      readerUrl: bollsReaderUrl(translation, 43, 3, 16),
      date,
    };
    return fallback;
  }
}

export function assertTranslation(value: string | undefined): BollsTranslation | undefined {
  if (!value) return undefined;
  return isBollsTranslation(value) ? value : undefined;
}
