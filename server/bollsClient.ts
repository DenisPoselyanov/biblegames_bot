import { stripBollsHtml } from '../src/lib/bollsText';
import type { BollsTranslation } from '../src/lib/bollsConstants';

const BOLLS_BASE = process.env.BOLLS_API_BASE || 'https://bolls.life';
const FETCH_TIMEOUT_MS = Number(process.env.BOLLS_FETCH_TIMEOUT_MS || 12000);

export interface BollsVerseRow {
  pk?: number;
  translation?: string;
  book?: number;
  chapter?: number;
  verse: number;
  text: string;
}

async function bollsFetch(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(`${BOLLS_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchBollsVerses(
  translation: BollsTranslation,
  bookId: number,
  chapter: number,
  verses: number[],
): Promise<BollsVerseRow[]> {
  const res = await bollsFetch('/get-verses/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([
      {
        translation,
        book: bookId,
        chapter,
        verses,
      },
    ]),
  });

  if (!res.ok) {
    throw new Error(`bolls_get_verses_${res.status}`);
  }

  const data = (await res.json()) as BollsVerseRow[][];
  const rows = data[0] ?? [];
  return rows
    .map((row) => ({
      ...row,
      verse: Number(row.verse),
      text: stripBollsHtml(String(row.text ?? '')),
    }))
    .filter((row) => row.text.length > 0)
    .sort((a, b) => a.verse - b.verse);
}

export async function fetchBollsChapter(
  translation: BollsTranslation,
  bookId: number,
  chapter: number,
): Promise<BollsVerseRow[]> {
  const res = await bollsFetch(`/get-text/${translation}/${bookId}/${chapter}/`);
  if (!res.ok) {
    throw new Error(`bolls_get_chapter_${res.status}`);
  }

  const data = await res.json();
  const rows = Array.isArray(data) ? data : [];
  return rows
    .map((row: { verse?: number; text?: string }) => ({
      verse: Number(row.verse),
      text: stripBollsHtml(String(row.text ?? '')),
    }))
    .filter((row) => Number.isFinite(row.verse) && row.text.length > 0)
    .sort((a, b) => a.verse - b.verse);
}

export interface BollsRandomVerse {
  book: number;
  chapter: number;
  verse: number;
  text: string;
}

export async function fetchBollsRandomVerse(translation: BollsTranslation): Promise<BollsRandomVerse> {
  const res = await bollsFetch(`/get-random-verse/${translation}/`);
  if (!res.ok) {
    throw new Error(`bolls_random_${res.status}`);
  }
  const row = (await res.json()) as {
    book?: number;
    chapter?: number;
    verse?: number;
    text?: string;
  };
  return {
    book: Number(row.book),
    chapter: Number(row.chapter),
    verse: Number(row.verse),
    text: stripBollsHtml(String(row.text ?? '')),
  };
}
