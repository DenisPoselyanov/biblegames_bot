import { describe, expect, it } from 'vitest';
import { expandReferenceStrings, normalizeQuestionReference, parseBibleReference } from './bibleReference';

describe('parseBibleReference — one canonical key from equivalent spellings (Phase 4 WS4)', () => {
  it.each([
    ['Ів 3:16', { bookId: 43, chapter: 3, verses: [16] }],
    ['Івана 3:16', { bookId: 43, chapter: 3, verses: [16] }],
    ['Ін 3:16', { bookId: 43, chapter: 3, verses: [16] }],
    ['John 3:16', { bookId: 43, chapter: 3, verses: [16] }],
    ['JHN.3.16', { bookId: 43, chapter: 3, verses: [16] }],
  ])('%s → %j', (input, expected) => {
    const parsed = parseBibleReference(input);
    expect(parsed?.bookId).toBe(expected.bookId);
    expect(parsed?.chapter).toBe(expected.chapter);
    expect(parsed?.verses).toEqual(expected.verses);
  });

  it('parses a dotted verse range', () => {
    const parsed = parseBibleReference('JHN.3.16-18');
    expect(parsed).toMatchObject({ bookId: 43, chapter: 3, verses: [16, 17, 18] });
  });

  it('returns null for an unresolvable book', () => {
    expect(parseBibleReference('Оксфорд 3:16')).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(parseBibleReference('')).toBeNull();
    expect(parseBibleReference('not a reference')).toBeNull();
  });

  it('parses a chapter-only reference as verse 1', () => {
    const parsed = parseBibleReference('Буття 1');
    expect(parsed).toMatchObject({ bookId: 1, chapter: 1, verses: [1] });
  });

  it('takes only the first segment of a multi-reference string', () => {
    const parsed = parseBibleReference('Ів 3:16; Рим 5:8');
    expect(parsed).toMatchObject({ bookId: 43, chapter: 3, verses: [16] });
  });
});

describe('normalizeQuestionReference / expandReferenceStrings', () => {
  it('joins an array reference with "; "', () => {
    expect(normalizeQuestionReference(['Ів 3:16', 'Рим 5:8'])).toBe('Ів 3:16; Рим 5:8');
  });

  it('returns undefined for null/empty input', () => {
    expect(normalizeQuestionReference(null)).toBeUndefined();
    expect(normalizeQuestionReference('  ')).toBeUndefined();
  });

  it('splits a "a; b" string into individual references', () => {
    expect(expandReferenceStrings('Ів 3:16; Рим 5:8')).toEqual(['Ів 3:16', 'Рим 5:8']);
  });
});

describe('parseBibleReference — inflected / abbreviated Ukrainian book names (content quality gate)', () => {
  const book = (ref: string) => parseBibleReference(ref)?.bookId ?? null;

  it.each([
    ['Іс. Нав. 6:20', 6],
    ['Повт. зак. 5:7', 5],
    ['Повторення закону 6:4', 5],
    ['Суддів 7:7', 7],
    ['1 Самуїлова 3:3', 9],
    ['2 Самуїлова 7:4', 10],
    ['2 Царів 2:11', 12],
    ['3 Царств 3:9', 11],
    ['1 Царств 7:15', 9],
    ['2 Хронік 7:1', 14],
    ['1 Петра 5:8', 60],
    ['1 Івана 4:8', 62],
    ['Йони 1:17', 32],
    ["Об'явлення 21:1", 66],
    ['Приповісті 3:5', 20],
    ['Естер 4:14', 17],
    ['Ісаї 53:5', 23],
  ])('%s → book %i', (ref, id) => {
    expect(book(ref)).toBe(id);
  });

  it('leaves non-Scripture and ambiguous sources unparsed so a reviewer sees them', () => {
    expect(book('Медична енциклопедія 12')).toBeNull();
    expect(book('Ав. 1:5')).toBeNull();
    expect(book('1 Мак. 2:1')).toBeNull();
  });
});
