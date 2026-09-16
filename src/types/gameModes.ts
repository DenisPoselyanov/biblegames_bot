export type GameModeId = 'study' | 'millionaire' | 'survival' | 'kahoot';

export interface GameMode {
  id: GameModeId;
  title: string;
  description: string;
  icon: string;
  badge?: string;
  available: boolean;
  path: string;
  /** Solo or with other players — Play Hub disclosure (§15.1). */
  social: 'solo' | 'group';
  /** Plain-language session length; open-ended modes describe their real stop condition instead of a fixed count. */
  duration: string;
  /** Plain-language reward policy — what a run can actually earn, matching the server-authoritative logic in `completionOutcome.ts`. */
  rewardPolicy: string;
  /** Short chip label for `rewardPolicy`, for the compact Play Hub card. */
  rewardShort: string;
  /** Whether playing this mode moves the shared study-mastery map read by Learn/Progress. */
  affectsMastery: boolean;
  /** Plain-language availability/offline note. */
  availability: string;
}

export const GAME_MODES: GameMode[] = [
  {
    id: 'study',
    title: 'Дослідження',
    description: 'Теми, рівні складності, особистий прогрес і монети',
    icon: '📖',
    available: true,
    path: '/play/study',
    social: 'solo',
    duration: '7 питань на рівень складності',
    rewardPolicy: 'Монети й досвід за складністю теми та точністю відповідей',
    rewardShort: 'Монети й досвід',
    affectsMastery: true,
    availability: 'Працює офлайн, прогрес синхронізується при з’єднанні',
  },
  {
    id: 'millionaire',
    title: 'Мільйонер',
    description: 'До 15 біблійних питань із підказками, незгораними рівнями та великим фінальним виграшем',
    icon: '💎',
    badge: 'NEW',
    available: true,
    path: '/play/study/millionaire',
    social: 'solo',
    duration: 'До 15 питань, без обмеження часу',
    rewardPolicy: 'Монети за кожен пройдений рівень; на помилці — відкат до найближчого безпечного рівня (5 або 10)',
    rewardShort: 'Монети за рівень',
    affectsMastery: false,
    availability: 'Працює офлайн, прогрес синхронізується при з’єднанні',
  },
  {
    id: 'survival',
    title: 'Виживання',
    description: 'Нескінченна серія питань із 3 життями, таймером і поступовим зростанням складності',
    icon: '🛡️',
    badge: 'NEW',
    available: true,
    path: '/play/study/survival',
    social: 'solo',
    duration: '3 життя, 20с на питання, без обмеження кількості питань',
    rewardPolicy: 'Монети за кожну правильну відповідь, залежно від складності питання',
    rewardShort: 'Монети за відповідь',
    affectsMastery: false,
    availability: 'Працює офлайн, прогрес синхронізується при з’єднанні',
  },
  {
    id: 'kahoot',
    title: 'Кімната (Kahoot)',
    description: 'Створи кімнату, друзі приєднуються за кодом і відповідають на час',
    icon: '⚡',
    badge: 'Мультиплеєр',
    available: true,
    path: '/play/kahoot',
    social: 'group',
    duration: '10 питань за замовчуванням, ~20с на питання (налаштовує ведучий)',
    rewardPolicy: 'Лише ігрові бали в кімнаті — монет чи досвіду профілю не дає',
    rewardShort: 'Без монет',
    affectsMastery: false,
    availability: 'Потребує інтернет-з’єднання для всіх учасників',
  },
];

export const KAHOOT_DEFAULTS = {
  questionCount: 10,
  timePerQuestionSec: 20,
  difficulty: 'youth' as const,
  flowMode: 'auto' as const,
  scoringMode: 'classic' as const,
  thinkTimeSec: 0,
  hostParticipates: false,
};
