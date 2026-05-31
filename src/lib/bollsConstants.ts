/** Переклади bolls.life, доступні в застосунку */
export const BOLLS_TRANSLATIONS = ['HOM', 'UBIO', 'UTT'] as const;

export type BollsTranslation = (typeof BOLLS_TRANSLATIONS)[number];

export const DEFAULT_BOLLS_TRANSLATION: BollsTranslation = 'UTT';

export const BOLLS_TRANSLATION_LABELS: Record<BollsTranslation, string> = {
  HOM: 'Іван Хоменко (1963)',
  UBIO: 'Іван Огієнко (1962)',
  UTT: 'Рафаїл Турконяк LXX (2011)',
};

export function isBollsTranslation(value: string): value is BollsTranslation {
  return (BOLLS_TRANSLATIONS as readonly string[]).includes(value);
}

export function normalizeBollsTranslation(value: string | undefined | null): BollsTranslation {
  if (value && isBollsTranslation(value)) return value;
  return DEFAULT_BOLLS_TRANSLATION;
}
