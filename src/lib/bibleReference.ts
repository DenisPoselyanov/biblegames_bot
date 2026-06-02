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
  ge: 1,
  gn: 1,
  твор: 1,
  творець: 1,
  творец: 1,
  творіння: 1,
  мойсей: 1,
  вих: 2,
  вихід: 2,
  exodus: 2,
  exo: 2,
  ex: 2,
  исх: 2,
  ісх: 2,
  ек: 2,
  екз: 2,
  изд: 2,
  ізд: 2,
  сд: 2,
  лев: 3,
  левит: 3,
  левіт: 3,
  leviticus: 3,
  lev: 3,
  лв: 3,
  вав: 3,
  чис: 4,
  числ: 4,
  числа: 4,
  numbers: 4,
  num: 4,
  нум: 4,
  втор: 5,
  deuteronomy: 5,
  deut: 5,
  деут: 5,
  опр: 5,
  пов: 5,
  // Історичні
  нав: 6,
  joshua: 6,
  jos: 6,
  'ісус навин': 6,
  'ісуса навина': 6,
  суд: 7,
  judges: 7,
  judg: 7,
  'книга суд': 7,
  рут: 8,
  ruth: 8,
  '1 сам': 9,
  '1sam': 9,
  '1 samuel': 9,
  '1 самуїл': 9,
  '1самуїл': 9,
  'і сам': 9,
  '1 царів': 11,
  'і царів': 11,
  '2 сам': 10,
  '2sam': 10,
  '2 samuel': 10,
  '2сам': 10,
  '1 цар': 11,
  '1цар': 11,
  '1 kings': 11,
  'і цар': 11,
  '3 цар': 11,
  '3цар': 11,
  царів: 11,
  цар: 11,
  '2 цар': 12,
  '2цар': 12,
  '2 kings': 12,
  'ii цар': 12,
  '4 цар': 12,
  '4цар': 12,
  '1 пар': 13,
  '1 chronicles': 13,
  '1кр': 13,
  '1 chr': 13,
  '1 хр': 13,
  'перша хроніка': 13,
  '2 пар': 14,
  '2 chronicles': 14,
  '2кр': 14,
  '2 chr': 14,
  '2 хр': 14,
  '2хр': 14,
  '2 кр': 14,
  езд: 15,
  ezra: 15,
  єзд: 15,
  неем: 16,
  nehemiah: 16,
  neh: 16,
  ест: 17,
  esther: 17,
  est: 17,
  // Поетичні / мудрість
  йов: 18,
  job: 18,
  йова: 18,
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
  пр: 20,
  прит: 20,
  'кн притч соломонових': 20,
  'притч соломонових': 20,
  еккл: 21,
  ecclesiastes: 21,
  eccl: 21,
  екл: 21,
  пісн: 22,
  song: 22,
  songs: 22,
  сол: 22,
  'пісня соломона': 22,
  'книга розпівів': 22,
  // Пророки
  іс: 23,
  isaiah: 23,
  isa: 23,
  ис: 23,
  із: 23,
  іса: 23,
  ісаїя: 23,
  єр: 24,
  jeremiah: 24,
  jer: 24,
  ієр: 24,
  плач: 25,
  lamentations: 25,
  lam: 25,
  єзек: 26,
  ezekiel: 26,
  ezek: 26,
  єз: 26,
  ез: 26,
  єс: 26,
  дан: 27,
  daniel: 27,
  dan: 27,
  дн: 27,
  ос: 28,
  hosea: 28,
  хол: 28,
  йоіл: 29,
  joel: 29,
  ам: 30,
  amos: 30,
  амос: 30,
  ама: 30,
  авд: 31,
  obadiah: 31,
  obad: 31,
  йона: 32,
  jonah: 32,
  jon: 32,
  йон: 32,
  іони: 32,
  'книга про йона': 32,
  'про йона': 32,
  мих: 33,
  micah: 33,
  mic: 33,
  мир: 33,
  наум: 34,
  nahum: 34,
  nah: 34,
  авв: 35,
  habakkuk: 35,
  hab: 35,
  соф: 36,
  zephaniah: 36,
  zeph: 36,
  аг: 37,
  haggai: 37,
  hag: 37,
  зах: 38,
  zechariah: 38,
  zech: 38,
  хр: 38,
  мал: 39,
  malachi: 39,
  mal: 39,
  // Євангелія
  матв: 40,
  матвія: 40,
  мт: 40,
  matthew: 40,
  matt: 40,
  mat: 40,
  мат: 40,
  мф: 40,
  мд: 40,
  'євангеліє від матвія': 40,
  мар: 41,
  марка: 41,
  мк: 41,
  mark: 41,
  мр: 41,
  марк: 41,
  'маркове євангеліє': 41,
  лк: 42,
  луки: 42,
  лука: 42,
  luke: 42,
  лук: 42,
  ін: 43,
  ів: 43,
  івана: 43,
  іван: 43,
  john: 43,
  jn: 43,
  йо: 43,
  іо: 43,
  іоан: 43,
  ин: 43,
  // Інше НЗ
  дії: 44,
  acts: 44,
  act: 44,
  акт: 44,
  актс: 44,
  ап: 44,
  ак: 44,
  ді: 44,
  дій: 44,
  дія: 44,
  дян: 44,
  деян: 44,
  діян: 44,
  рим: 45,
  romans: 45,
  rom: 45,
  '1 кор': 46,
  '1 corinthians': 46,
  '1cor': 46,
  '1кор': 46,
  '2 кор': 47,
  '2 corinthians': 47,
  '2cor': 47,
  '2кор': 47,
  гал: 48,
  galatians: 48,
  gal: 48,
  еф: 49,
  ephesians: 49,
  eph: 49,
  фил: 50,
  philippians: 50,
  phil: 50,
  філ: 50,
  кол: 51,
  colossians: 51,
  col: 51,
  колос: 51,
  '1 сол': 52,
  '1 thessalonians': 52,
  '1 thess': 52,
  '1 фес': 52,
  '1фес': 52,
  '2 сол': 53,
  '2 thessalonians': 53,
  '2 thess': 53,
  '1 тим': 54,
  '1 timothy': 54,
  '1tim': 54,
  тим: 54,
  '2 тим': 55,
  '2 timothy': 55,
  '2tim': 55,
  '2тим': 55,
  тит: 56,
  titus: 56,
  tit: 56,
  флм: 57,
  philemon: 57,
  phlm: 57,
  philem: 57,
  євр: 58,
  hebrews: 58,
  heb: 58,
  евр: 58,
  якова: 59,
  james: 59,
  jas: 59,
  як: 59,
  '1 пет': 60,
  '1 peter': 60,
  '1pet': 60,
  '2 пет': 61,
  '2 peter': 61,
  '2pet': 61,
  '2 петр': 61,
  '2пет': 61,
  '1 ін': 62,
  '1 ів': 62,
  '1 john': 62,
  '1jn': 62,
  '2 ін': 63,
  '2 ів': 63,
  '2 john': 63,
  '2jn': 63,
  '3 ін': 64,
  '3 ів': 64,
  '3 john': 64,
  '3jn': 64,
  юда: 65,
  jude: 65,
  jud: 65,
  юд: 65,
  юди: 65,
  івд: 65,
  об: 66,
  відкр: 66,
  відкриття: 66,
  revelation: 66,
  rev: 66,
  re: 66,
  apocalypse: 66,
  одк: 66,
  одкр: 66,
  опв: 66,
  // У базі інколи «От.» замість «Вих.» (Вихід)
  от: 2,
  откр: 66,
  іл: 11,
  шм: 10,
  шма: 10,
  шмa: 10,
};

function normalizeRomanPrefix(key: string): string {
  return key
    .replace(/^ііі(?=\s|$)/u, '3 ')
    .replace(/^iii(?=\s|$)/, '3 ')
    .replace(/^іі(?=\s|$)/u, '2 ')
    .replace(/^ii(?=\s|$)/, '2 ')
    .replace(/^iv(?=\s|$)/, '4 ')
    .replace(/^і(?=\s|$)/u, '1 ')
    .replace(/^i(?=\s|$)/, '1 ')
    .trim();
}

function normalizeHomoglyphs(key: string): string {
  if (!/[а-яіїєґ]/u.test(key)) return key;
  return key
    .replace(/a/g, 'а')
    .replace(/c/g, 'с')
    .replace(/e/g, 'е')
    .replace(/i/g, 'і')
    .replace(/m/g, 'м')
    .replace(/o/g, 'о')
    .replace(/p/g, 'р')
    .replace(/t/g, 'т')
    .replace(/x/g, 'х')
    .replace(/y/g, 'у');
}

function normalizeBookKey(raw: string): string {
  let key = raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/^книга\s+/u, '')
    .replace(/^кн\.?\s+/u, '')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  key = normalizeHomoglyphs(key);
  key = normalizeRomanPrefix(key);
  return key;
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
    raw.match(/^(.+?)\.\s*(\d{1,3})\s*:\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?/i) ??
    raw.match(/^(.+?)\.\s*(\d{1,3})\s*$/i) ??
    raw.match(/^(.+?)\s+(\d{1,3})\s*(?:\(|$)/i);

  if (!match) return null;

  const bookPart = match[1].replace(/\.\s*$/, '').trim();
  const chapter = Number(match[2]);
  const verseStart = match[3] != null ? Number(match[3]) : 1;
  const verseEnd = match[4] ? Number(match[4]) : verseStart;

  const bookId = resolveBookId(bookPart);
  if (!bookId || !Number.isFinite(chapter) || chapter < 1) return null;

  const verses = expandVerseRange(verseStart, verseEnd);
  if (verses.length === 0) return null;

  return { bookId, chapter, verses, raw };
}
