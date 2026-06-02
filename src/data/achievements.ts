export type AchievementId =
  | 'biblical-millionaire'
  | 'iron-shield'
  | 'flawless-level'
  | 'aesthete'
  | 'cartographer'
  | 'streak-7'
  | 'review-master'
  | 'mastery-expert';

export interface Achievement {
  id: AchievementId;
  title: string;
  description: string;
  icon: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'biblical-millionaire',
    title: 'Біблійний мільйонер',
    description: 'Пройти всі питання в одному забігу режиму «Мільйонер».',
    icon: '🏆',
  },
  {
    id: 'iron-shield',
    title: 'Залізний щит',
    description: 'Набрати 30 або більше правильних відповідей у режимі «Виживання».',
    icon: '🛡️',
  },
  {
    id: 'flawless-level',
    title: 'Безпомилковий',
    description: 'Пройти рівень соло-гри з результатом 7/7.',
    icon: '💡',
  },
  {
    id: 'aesthete',
    title: 'Естет',
    description: 'Придбати першу тему оформлення.',
    icon: '🎨',
  },
  {
    id: 'cartographer',
    title: 'Картограф',
    description: 'Пройти тему «Географія» на рівні «Експерт».',
    icon: '🗺️',
  },
  {
    id: 'streak-7',
    title: 'Вірність 7 днів',
    description: 'Підтримувати streak у навчанні 7 днів підряд.',
    icon: '🔥',
  },
  {
    id: 'review-master',
    title: 'Майстер повторення',
    description: 'Закрити щоденне завдання повторення підтем.',
    icon: '🧠',
  },
  {
    id: 'mastery-expert',
    title: 'Вчений',
    description: 'Досягти 100% майстерності хоча б у одній підтемі.',
    icon: '🎓',
  },
];

export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((achievement) => achievement.id === id);
}
