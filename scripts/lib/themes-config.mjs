/** Єдиний список тем (синхронізовано з src/data/themes.ts) */
export const THEMES = [
  { id: 'geography', title: 'Географія', context: 'Місця, річки, гори, міста, країни Святого Письма. Точні біблійні факти.' },
  { id: 'old-testament', title: 'Старий Завіт', context: 'Події та постаті ВЗ: Авраам, Мойсей, Давид, пророки, закон.' },
  { id: 'mosaic-law', title: 'Закон Мойсея', context: 'Заповіді, скинія, жертви, святі дні, устави Тори.' },
  { id: 'paul', title: 'Апостол Павло', context: 'Подорожі, листи, навернення, служіння апостола Павла.' },
  { id: 'judges', title: 'Судді', context: 'Судді Ізраїля: Гедеон, Самсон, Девора, Єфта та ін.' },
  { id: 'kings', title: 'Царі', context: 'Царі Ізраїля та Юдеї: Саул, Давид, Соломон, розкол царств.' },
  { id: 'new-testament', title: 'Новий Завіт', context: 'Церква, апостоли, вчення, раннє християнство.' },
  { id: 'gospels', title: 'Євангелія', context: 'Життя, слова, чудеса, смерть і воскресіння Ісуса Христа.' },
  { id: 'prophets', title: 'Пророки', context: 'Пророки ВЗ і їх пророцтва: Ісая, Єремія, Ілля, Даниїл.' },
  { id: 'psalms', title: 'Псалми', context: 'Псалми, поклоніння, Давид, храмова поезія.' },
  { id: 'parables', title: 'Притчі', context: 'Притчі Ісуса Христа та їх значення.' },
  { id: 'commandments', title: 'Десять заповідень', context: 'Десять заповідь, Закон на Синаї, їх зміст.' },
  { id: 'miracles', title: 'Чудеса Ісуса', context: 'Чудеса Ісуса: зцілення, воскресіння, природа.' },
  { id: 'patriarchs', title: 'Патріархи', context: 'Патріархи: Авраам, Ісак, Яків, Йосиф.' },
  { id: 'revelation', title: 'Відкриття', context: 'Книга Одкровення, символи, церкви, останні події.' },
];

export const DIFFICULTIES = ['baby', 'child', 'youth', 'student', 'preacher', 'teacher', 'theologian'];

export const THEME_IDS = THEMES.map((t) => t.id);

export function getTheme(id) {
  return THEMES.find((t) => t.id === id);
}
