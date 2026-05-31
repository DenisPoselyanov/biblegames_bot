/** Знімає HTML-теги з тексту вірша bolls (поле text — HTML). */
export function stripBollsHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

export function bollsReaderUrl(translation: string, bookId: number, chapter: number, verse?: number): string {
  const base = `https://bolls.life/#/${translation}/${bookId}/${chapter}`;
  return verse != null ? `${base}/${verse}` : base;
}
