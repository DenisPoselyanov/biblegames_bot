import type { Theme } from '../types';

export const THEMES: Theme[] = [
  {
    id: 'geography',
    title: 'Географія',
    description: 'Місця, річки та країни Святого Письма',
    icon: '🗺️',
    color: '#4a7c59',
  },
  {
    id: 'old-testament',
    title: 'Старий Завіт',
    description: 'Події та постаті до приходу Христа',
    icon: '📜',
    color: '#8b6914',
  },
  {
    id: 'mosaic-law',
    title: 'Закон Мойсея',
    description: 'Заповіді, устави та святині',
    icon: '⚖️',
    color: '#5c4d7a',
  },
  {
    id: 'paul',
    title: 'Апостол Павло',
    description: 'Подорожі, листи та служіння',
    icon: '✉️',
    color: '#b85c38',
  },
  {
    id: 'judges',
    title: 'Судді',
    description: 'Гедеон, Самсон, Девора та інші',
    icon: '⚔️',
    color: '#6b4423',
  },
  {
    id: 'kings',
    title: 'Царі',
    description: 'Давид, Соломон та царства Ізраїля',
    icon: '👑',
    color: '#c9a227',
  },
  {
    id: 'new-testament',
    title: 'Новий Завіт',
    description: 'Церква, апостоли та вчення',
    icon: '✝️',
    color: '#2e5a88',
  },
  {
    id: 'gospels',
    title: 'Євангелія',
    description: 'Життя, слова та чудеса Ісуса',
    icon: '📖',
    color: '#3d6b8e',
  },
  {
    id: 'prophets',
    title: 'Пророки',
    description: 'Ісая, Єремія, Ілля та інші',
    icon: '🔥',
    color: '#a04020',
  },
  {
    id: 'psalms',
    title: 'Псалми',
    description: 'Псалми Давида та поклоніння',
    icon: '🎵',
    color: '#7a5c8a',
  },
  {
    id: 'parables',
    title: 'Притчі',
    description: 'Притчі Ісуса Христа',
    icon: '🌾',
    color: '#6b8e4e',
  },
  {
    id: 'commandments',
    title: 'Десять заповідей',
    description: 'Божий закон на Синаї',
    icon: '📋',
    color: '#4a5568',
  },
  {
    id: 'miracles',
    title: 'Чудеса Ісуса',
    description: 'Зцілення, воскресіння та знамення',
    icon: '✨',
    color: '#d4a017',
  },
  {
    id: 'patriarchs',
    title: 'Патріархи',
    description: 'Авраам, Ісак, Яків та Йосиф',
    icon: '🏕️',
    color: '#8b7355',
  },
  {
    id: 'revelation',
    title: 'Відкриття',
    description: 'Апокаліпсис та останні події',
    icon: '🌅',
    color: '#9b2335',
  },
];

export function getThemeById(id: string): Theme | undefined {
  return THEMES.find((t) => t.id === id);
}
