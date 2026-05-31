export interface StudySubTheme {
  id: string;
  title: string;
  description: string;
  icon: string;
  themeId: string;
}

export interface StudyThemeGroup {
  id: string;
  title: string;
  description: string;
  icon: string;
  subthemes: StudySubTheme[];
}

export const STUDY_THEME_GROUPS: StudyThemeGroup[] = [
  {
    id: 'old-testament-world',
    title: 'Світ Старого Завіту',
    description: 'Люди, закон і історія Божого народу до приходу Христа',
    icon: '📜',
    subthemes: [
      { id: 'patriarchs-path', title: 'Патріархи', description: 'Авраам, Ісак, Яків і Йосиф', icon: '🏕️', themeId: 'patriarchs' },
      { id: 'sinai-law', title: 'Закон Мойсея', description: 'Заповіді, устави та святині', icon: '⚖️', themeId: 'mosaic-law' },
      { id: 'kings-and-judges', title: 'Царі та Судді', description: 'Лідери Ізраїля в епоху випробувань', icon: '👑', themeId: 'kings' },
    ],
  },
  {
    id: 'new-testament-world',
    title: 'Світ Нового Завіту',
    description: 'Євангелія, апостоли та народження Церкви',
    icon: '✝️',
    subthemes: [
      { id: 'gospels-life', title: 'Євангелія', description: 'Життя і слова Ісуса Христа', icon: '📖', themeId: 'gospels' },
      { id: 'acts-and-letters', title: 'Апостол Павло', description: 'Подорожі та послання', icon: '✉️', themeId: 'paul' },
      { id: 'miracles-of-jesus', title: 'Чудеса Ісуса', description: 'Знамення, зцілення і віра', icon: '✨', themeId: 'miracles' },
    ],
  },
  {
    id: 'bible-context',
    title: 'Контекст Біблії',
    description: 'Місця, поезія і пророчий погляд',
    icon: '🗺️',
    subthemes: [
      { id: 'bible-geography-ot', title: 'Географія СЗ', description: 'Місця та регіони Старого Завіту', icon: '🗺️', themeId: 'geography' },
      { id: 'bible-geography-nt', title: 'Географія НЗ', description: 'Місця Ісуса, апостолів і місій', icon: '🧭', themeId: 'geography-nt' },
      { id: 'psalms-and-worship', title: 'Псалми', description: 'Молитва, поклоніння і серце', icon: '🎵', themeId: 'wisdom-poetry' },
      { id: 'prophets-voice', title: 'Пророки', description: 'Заклик до покаяння і надії', icon: '🔥', themeId: 'prophets' },
    ],
  },
];
