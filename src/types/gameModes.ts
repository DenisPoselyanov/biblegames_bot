export type GameModeId = 'study' | 'millionaire' | 'survival' | 'kahoot';

export interface GameMode {
  id: GameModeId;
  title: string;
  description: string;
  icon: string;
  badge?: string;
  available: boolean;
  path: string;
}

export const GAME_MODES: GameMode[] = [
  {
    id: 'study',
    title: 'Дослідження',
    description: 'Теми, рівні складності, особистий прогрес і очки',
    icon: '📖',
    available: true,
    path: '/play/study',
  },
  {
    id: 'millionaire',
    title: 'Мільйонер',
    description: '15 біблійних питань із підказками, незгораними рівнями та великим фінальним виграшем',
    icon: '💎',
    badge: 'NEW',
    available: true,
    path: '/play/study/millionaire',
  },
  {
    id: 'survival',
    title: 'Виживання',
    description: 'Нескінченна серія питань із 3 життями, таймером і поступовим зростанням складності',
    icon: '🛡️',
    badge: 'NEW',
    available: true,
    path: '/play/study/survival',
  },
  {
    id: 'kahoot',
    title: 'Кімната (Kahoot)',
    description: 'Створи кімнату, друзі приєднуються за кодом і відповідають на час',
    icon: '⚡',
    badge: 'Мультиплеєр',
    available: true,
    path: '/play/kahoot',
  },
];

export const KAHOOT_DEFAULTS = {
  questionCount: 10,
  timePerQuestionSec: 20,
  difficulty: 'youth' as const,
};
