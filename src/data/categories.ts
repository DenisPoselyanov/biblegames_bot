import type { Category } from '../types';

export const CATEGORIES: Category[] = [
  {
    id: 'old-testament',
    title: 'Старий Завіт',
    description: 'Події та постаті до приходу Христа',
    icon: '📜',
    color: '#8b6914',
    themeIds: [
      'old-testament',
      'pentateuch',
      'patriarchs',
      'judges',
      'kings',
      'wisdom-poetry',
      'prophets',
      'mosaic-law',
      'commandments',
      'geography',
    ],
  },
  {
    id: 'new-testament',
    title: 'Новий Завіт',
    description: 'Церква, апостоли та вчення',
    icon: '✝️',
    color: '#2e5a88',
    themeIds: [
      'new-testament',
      'gospels',
      'acts',
      'paul',
      'general-epistles',
      'revelation',
      'geography-nt',
      'parables',
      'miracles',
    ],
  },
];

export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function getCategoryByThemeId(themeId: string): Category | undefined {
  return CATEGORIES.find((c) => c.themeIds.includes(themeId));
}

export function getThemeIdsByCategory(categoryId: string): string[] {
  const cat = getCategoryById(categoryId);
  return cat ? cat.themeIds : [];
}
