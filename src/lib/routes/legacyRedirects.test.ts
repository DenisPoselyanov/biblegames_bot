import { describe, expect, it } from 'vitest';
import { LEGACY_REDIRECTS } from './legacyRedirects';

describe('legacyRedirects', () => {
  it('sends generic legacy hub paths straight to their new-IA equivalent', () => {
    expect(LEGACY_REDIRECTS.legacyPlayStudy.resolve({}, '')).toEqual({ to: '/learn', matched: true });
    expect(LEGACY_REDIRECTS.legacyPlayStudyReviewQueue.resolve({ themeId: 't1' }, '')).toEqual({
      to: '/review',
      matched: true,
    });
    expect(LEGACY_REDIRECTS.legacyProfileProgress.resolve({}, '')).toEqual({ to: '/progress', matched: true });
  });

  it('flags id-carrying legacy paths as unmapped (§5.2) instead of guessing a destination', () => {
    const result = LEGACY_REDIRECTS.legacyPlayStudyThemeDetail.resolve({ themeId: 't1' }, '');
    expect(result.matched).toBe(false);
    expect(result.to).toBe('/learn');
  });

  it('preserves legacy theme/difficulty intent as query params on the practice redirect', () => {
    const result = LEGACY_REDIRECTS.legacyPlayStudyQuiz.resolve(
      { themeId: 'genesis', difficulty: 'hard' },
      '',
    );
    expect(result.matched).toBe(true);
    expect(result.to).toBe('/practice?legacyTheme=genesis&legacyDifficulty=hard');
  });

  it('every entry key matches its own id field', () => {
    for (const [key, entry] of Object.entries(LEGACY_REDIRECTS)) {
      expect(entry.id).toBe(key);
    }
  });
});
