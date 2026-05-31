/**
 * Контекст глави для AI-скриптів (F13).
 * import { fetchChapterPlainText } from './lib/bolls-chapter.mjs';
 */
const BOLLS_BASE = process.env.BOLLS_API_BASE || 'https://bolls.life';
const TRANSLATION = process.env.BOLLS_DEFAULT_TRANSLATION || 'UTT';

function stripHtml(html) {
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchChapterPlainText(bookId, chapter, translation = TRANSLATION) {
  const res = await fetch(`${BOLLS_BASE}/get-text/${translation}/${bookId}/${chapter}/`);
  if (!res.ok) throw new Error(`bolls chapter ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows)) return '';
  return rows
    .map((r) => `${r.verse}. ${stripHtml(r.text)}`)
    .join('\n');
}
