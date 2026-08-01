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
      'judges',
      'kings',
      'prophets',
      'wisdom-poetry',
      'geography',
    ],
    aggregateExtraThemeIds: ['patriarchs', 'commandments'],
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
      'parables',
      'miracles',
      'acts',
      'paul',
      'general-epistles',
      'revelation',
      'geography-nt',
    ],
  },
];

export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function getCategoryByThemeId(themeId: string): Category | undefined {
  return CATEGORIES.find(
    (c) => c.themeIds.includes(themeId) || (c.aggregateExtraThemeIds?.includes(themeId) ?? false),
  );
}

export function getThemeIdsByCategory(categoryId: string): string[] {
  const cat = getCategoryById(categoryId);
  if (!cat) return [];
  return [...cat.themeIds, ...(cat.aggregateExtraThemeIds ?? [])];
}

/** themeIds that appear as top-level browse branches (excludes embedded themes) */
export function getBrowseThemeIdsByCategory(categoryId: string): string[] {
  const cat = getCategoryById(categoryId);
  return cat ? cat.themeIds : [];
}
