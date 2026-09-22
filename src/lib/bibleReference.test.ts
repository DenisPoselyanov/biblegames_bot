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
