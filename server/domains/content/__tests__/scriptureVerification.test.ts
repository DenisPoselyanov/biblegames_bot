import { describe, expect, it } from 'vitest';
import { createMockScriptureSourceAdapter } from '../../../infrastructure/scripture/mockSourceAdapter';
import { classifyQuotation, verifyScriptureReference } from '../scriptureVerification';

const JOHN_3_16 =
  'Так бо Бог полюбив світ, що дав Сина Свого Однородженого, щоб кожен, хто вірує в Нього, не загинув, а мав життя вічне.';

const adapter = createMockScriptureSourceAdapter([
  { bookId: 43, chapter: 3, verse: 16, text: JOHN_3_16 },
]);

describe('classifyQuotation', () => {
  it('matches on an exact (whitespace/punctuation-insensitive) quote', () => {
    expect(classifyQuotation(JOHN_3_16, JOHN_3_16)).toBe('match');
    expect(classifyQuotation(`  ${JOHN_3_16.toUpperCase()}  `, JOHN_3_16)).toBe('match');
  });

  it('classifies a lightly shortened quote as paraphrase, not mismatch', () => {
    const shortened = 'Так бо Бог полюбив світ, що дав Сина Свого, щоб кожен, хто вірує, мав життя вічне.';
    expect(classifyQuotation(shortened, JOHN_3_16)).toBe('paraphrase');
  });

  it('classifies an unrelated quote as mismatch', () => {
    expect(classifyQuotation('Спочатку Бог створив небо і землю.', JOHN_3_16)).toBe('mismatch');
  });
});

describe('verifyScriptureReference', () => {
  it('returns not_found for a reference that does not parse', async () => {
    const result = await verifyScriptureReference(
      { reference: 'Оксфорд 3:16', quotedText: null, translation: 'UTT' },
      adapter,
    );
    expect(result.verdict).toBe('not_found');
    expect(result.reason).toBe('unparsed_reference');
    expect(result.sourceText).toBeNull();
  });

  it('returns not_found when the source has no data for a resolvable reference', async () => {
    const result = await verifyScriptureReference(
      { reference: 'Ів 1:1', quotedText: null, translation: 'UTT' },
      adapter,
    );
    expect(result.verdict).toBe('not_found');
    expect(result.reason).toBe('source_unavailable');
    expect(result.bookId).toBe(43);
  });

  it('resolves "Ів 3:16", "Івана 3:16" and "JHN.3.16" to the same evidence', async () => {
    for (const reference of ['Ів 3:16', 'Івана 3:16', 'JHN.3.16']) {
      const result = await verifyScriptureReference({ reference, quotedText: null, translation: 'UTT' }, adapter);
      expect(result.bookId).toBe(43);
      expect(result.chapter).toBe(3);
      expect(result.verseStart).toBe(16);
      expect(result.sourceText).toBe(JOHN_3_16);
    }
  });

  it('with no quotedText, only confirms existence — verdict match, reason no_quotation_to_check', async () => {
    const result = await verifyScriptureReference(
      { reference: 'Ів 3:16', quotedText: null, translation: 'UTT' },
      adapter,
    );
    expect(result.verdict).toBe('match');
    expect(result.reason).toBe('no_quotation_to_check');
  });

  it('classifies an exact quotedText as match', async () => {
    const result = await verifyScriptureReference(
      { reference: 'Ів 3:16', quotedText: JOHN_3_16, translation: 'UTT' },
      adapter,
    );
    expect(result.verdict).toBe('match');
    expect(result.reason).toBe('ok');
  });

  it('classifies a wrong quotedText as mismatch even though the reference itself resolves', async () => {
    const result = await verifyScriptureReference(
      { reference: 'Ів 3:16', quotedText: 'Господь — мій пастир, я ні в чому не буду нужди мати.', translation: 'UTT' },
      adapter,
    );
    expect(result.verdict).toBe('mismatch');
  });

  it('carries the adapter version on every outcome', async () => {
    const result = await verifyScriptureReference(
      { reference: 'Ів 3:16', quotedText: null, translation: 'UTT' },
      adapter,
    );
    expect(result.adapterVersion).toBe('mock-scripture-v1');
  });
});
