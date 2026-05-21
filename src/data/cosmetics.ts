export interface CosmeticTheme {
  id: string;
  title: string;
  description: string;
  price: number;
  preview: {
    background: string;
    surface: string;
    primary: string;
    accent: string;
    text: string;
  };
}

export const DEFAULT_COSMETIC_THEME_ID = 'classic';

export const COSMETIC_THEMES: CosmeticTheme[] = [
  {
    id: DEFAULT_COSMETIC_THEME_ID,
    title: 'Класичний стиль',
    description: 'Строгі золоті акценти на спокійному темному фоні.',
    price: 0,
    preview: {
      background: '#101820',
      surface: '#182430',
      primary: '#d8a84e',
      accent: '#f1d28a',
      text: '#f8f3e7',
    },
  },
  {
    id: 'gennesaret-sea',
    title: 'Генісаретське море',
    description: 'Глибокий синій колір води й теплі піщані береги Галилеї.',
    price: 300,
    preview: {
      background: '#0f2f3f',
      surface: '#174b61',
      primary: '#62b6cb',
      accent: '#f2cc8f',
      text: '#f7fbff',
    },
  },
  {
    id: 'eden-garden',
    title: 'Едемський сад',
    description: 'Оливково-зелені відтінки із золотавими квітковими акцентами.',
    price: 500,
    preview: {
      background: '#18251a',
      surface: '#2c432e',
      primary: '#8fb56f',
      accent: '#e0b95a',
      text: '#f7f5e8',
    },
  },
  {
    id: 'sinai-revelation',
    title: 'Синайське одкровення',
    description: 'Вечірні фіолетово-багряні тони з вогненними акцентами.',
    price: 700,
    preview: {
      background: '#21162f',
      surface: '#3a244a',
      primary: '#c8553d',
      accent: '#f28c28',
      text: '#fff6ef',
    },
  },
  {
    id: 'heavenly-jerusalem',
    title: 'Небесний Єрусалим',
    description: 'Перлинно-біла основа та яскраве королівське золото.',
    price: 1000,
    preview: {
      background: '#f7f4ea',
      surface: '#ffffff',
      primary: '#c9a227',
      accent: '#6c63ff',
      text: '#24242e',
    },
  },
];

export function getCosmeticThemeById(id: string): CosmeticTheme | undefined {
  return COSMETIC_THEMES.find((theme) => theme.id === id);
}

export interface Avatar {
  id: string;
  title: string;
  emoji: string;
  price: number;
}

export const AVATARS: Avatar[] = [
  { id: 'fish', title: 'Риба (Іхтіс)', emoji: '🐟', price: 50 },
  { id: 'dove', title: 'Голуб миру', emoji: '🕊️', price: 150 },
  { id: 'lion', title: 'Лев Юди', emoji: '🦁', price: 200 },
  { id: 'crown', title: 'Корона життя', emoji: '👑', price: 250 },
  { id: 'shield', title: 'Щит віри', emoji: '🛡️', price: 300 },
  { id: 'sword', title: 'Меч Духа', emoji: '⚔️', price: 350 },
];

export function getAvatarById(id: string): Avatar | undefined {
  return AVATARS.find(a => a.id === id);
}
