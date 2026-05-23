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
      'mosaic-law',
      'judges',
      'kings',
      'prophets',
      'psalms',
      'patriarchs',
      'geography',
      'commandments',
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
      'paul',
      'parables',
      'miracles',
      'revelation',
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
