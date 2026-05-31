/** Поле reference у JSON може бути рядком або масивом рядків. */
export function normalizeQuestionReference(reference: unknown): string | undefined {
  if (reference == null) return undefined;
  if (Array.isArray(reference)) {
    const parts = reference.map((r) => String(r).trim()).filter(Boolean);
    return parts.length > 0 ? parts.join('; ') : undefined;
  }
  const s = String(reference).trim();
  return s.length > 0 ? s : undefined;
}

/** Окремі посилання для аудиту / запитів (масив або «а; б»). */
export function expandReferenceStrings(reference: unknown): string[] {
  if (reference == null) return [];
  if (Array.isArray(reference)) {
    return reference.map((r) => String(r).trim()).filter(Boolean);
  }
  const s = String(reference).trim();
  if (!s) return [];
  return s.split(/[;|]/).map((part) => part.trim()).filter(Boolean);
}

export interface ParsedBibleReference {
  bookId: number;
  chapter: number;
  verses: number[];
  raw: string;
}

/** Стандартна нумерація книг (1–66, протестантський канон). */
const BOOK_ALIASES: Record<string, number> = {
  // Пентатеух
  бут: 1,
  буття: 1,
  genesis: 1,
  gen: 1,
  вих: 2,
  вихід: 2,
  exodus: 2,
  exo: 2,
  исх: 2,
  лев: 3,
  leviticus: 3,
  lev: 3,
  чис: 4,
  numbers: 4,
  num: 4,
  втор: 5,
  deuteronomy: 5,
  deut: 5,
  // Історичні
  нав: 6,
  joshua: 6,
  суд: 7,
  judges: 7,
  рут: 8,
  ruth: 8,
  '1 сам': 9,
  '1sam': 9,
  '1 samuel': 9,
  '2 сам': 10,
  '2sam': 10,
  '2 samuel': 10,
  '1 цар': 11,
  '1 kings': 11,
  '2 цар': 12,
  '2 kings': 12,
  '1 пар': 13,
  '1 chronicles': 13,
  '2 пар': 14,
  '2 chronicles': 14,
  езд: 15,
  ezra: 15,
  неем: 16,
  nehemiah: 16,
  ест: 17,
  esther: 17,
  // Поетичні / мудрість
  йов: 18,
  job: 18,
  пс: 19,
  псал: 19,
  псалом: 19,
  псалми: 19,
  psalm: 19,
  psalms: 19,
  ps: 19,
  прип: 20,
  proverbs: 20,
  prov: 20,
  еккл: 21,
  ecclesiastes: 21,
  пісн: 22,
  song: 22,
  // Пророки
  іс: 23,
  isaiah: 23,
  isa: 23,
  єр: 24,
  jeremiah: 24,
  jer: 24,
  плач: 25,
  lamentations: 25,
  єзек: 26,
  ezekiel: 26,
  ezek: 26,
  дан: 27,
  daniel: 27,
  dan: 27,
  ос: 28,
  hosea: 28,
  йоіл: 29,
  joel: 29,
  ам: 30,
  amos: 30,
  авд: 31,
  obadiah: 31,
  йона: 32,
  jonah: 32,
  мих: 33,
  micah: 33,
  наум: 34,
  nahum: 34,
  авв: 35,
  habakkuk: 35,
  соф: 36,
  zephaniah: 36,
  аг: 37,
  haggai: 37,
  зах: 38,
  zechariah: 38,
  мал: 39,
  malachi: 39,
  // Євангелія
  матв: 40,
  матвія: 40,
  мт: 40,
  matthew: 40,
  matt: 40,
  мар: 41,
  марка: 41,
  мк: 41,
  mark: 41,
  лк: 42,
  луки: 42,
  лука: 42,
  luke: 42,
  ін: 43,
  івана: 43,
  john: 43,
  jn: 43,
  // Інше НЗ
  дії: 44,
  acts: 44,
  рим: 45,
  romans: 45,
  rom: 45,
  '1 кор': 46,
  '1 corinthians': 46,
  '2 кор': 47,
  '2 corinthians': 47,
  гал: 48,
  galatians: 48,
  еф: 49,
  ephesians: 49,
  фил: 50,
  philippians: 50,
  кол: 51,
  colossians: 51,
  '1 сол': 52,
  '1 thessalonians': 52,
  '2 сол': 53,
  '2 thessalonians': 53,
  '1 тим': 54,
  '1 timothy': 54,
  '2 тим': 55,
  '2 timothy': 55,
  тит: 56,
  titus: 56,
  флм: 57,
  philemon: 57,
  євр: 58,
  hebrews: 58,
  heb: 58,
  якова: 59,
  james: 59,
  '1 пет': 60,
  '1 peter': 60,
  '2 пет': 61,
  '2 peter': 61,
  '1 ін': 62,
  '1 john': 62,
  '2 ін': 63,
  '2 john': 63,
  '3 ін': 64,
  '3 john': 64,
  юда: 65,
  jude: 65,
  об: 66,
  відкр: 66,
  revelation: 66,
  rev: 66,
  // У базі інколи «От.» замість «Вих.» (Вихід)
  от: 2,
  откр: 66,
};

function normalizeBookKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandVerseRange(start: number, end: number): number[] {
  if (end < start) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  const out: number[] = [];
  for (let v = start; v <= end && out.length < 120; v += 1) out.push(v);
  return out;
}

function resolveBookId(bookPart: string): number | null {
  const key = normalizeBookKey(bookPart);
  if (BOOK_ALIASES[key] != null) return BOOK_ALIASES[key];

  // "1 Пет" vs "1пет"
  const compact = key.replace(/\s/g, '');
  if (BOOK_ALIASES[compact] != null) return BOOK_ALIASES[compact];

  return null;
}

/**
 * Парсить посилання з question.reference (перший сегмент, якщо їх кілька).
 */
export function parseBibleReference(input: string): ParsedBibleReference | null {
  const raw = input.trim().split(/[;|]/)[0]?.trim() ?? '';
  if (!raw) return null;

  const match =
    raw.match(/^(.+?)\s+(\d{1,3})\s*:\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?/i) ??
    raw.match(/^(.+?)\.\s*(\d{1,3})\s*:\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?/i);

  if (!match) return null;

  const bookPart = match[1].replace(/\.\s*$/, '').trim();
  const chapter = Number(match[2]);
  const verseStart = Number(match[3]);
  const verseEnd = match[4] ? Number(match[4]) : verseStart;

  const bookId = resolveBookId(bookPart);
  if (!bookId || !Number.isFinite(chapter) || chapter < 1) return null;

  const verses = expandVerseRange(verseStart, verseEnd);
  if (verses.length === 0) return null;

  return { bookId, chapter, verses, raw };
}
