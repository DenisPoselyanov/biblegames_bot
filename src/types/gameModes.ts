export type GameModeId = 'solo' | 'kahoot';

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
    id: 'solo',
    title: 'Соло',
    description: 'Теми, рівні складності, особистий прогрес і очки',
    icon: '📖',
    available: true,
    path: '/play/solo',
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
  difficulty: 'medium' as const,
};
