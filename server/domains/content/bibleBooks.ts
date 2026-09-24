/**
 * Ukrainian book names (Ohienko) by the 1–66 Protestant order used by
 * `src/lib/bibleReference.ts` — for prompts and reviewer-facing text, where a
 * bare book id means nothing.
 */
export const BOOK_NAMES_UK: readonly string[] = [
  '',
  'Буття',
  'Вихід',
  'Левит',
  'Числа',
  'Повторення Закону',
  'Ісус Навин',
  'Судді',
  'Рут',
  '1 Самуїлова',
  '2 Самуїлова',
  '1 Царів',
  '2 Царів',
  '1 Хроніки',
  '2 Хроніки',
  'Ездра',
  'Неемія',
  'Естер',
  'Йов',
  'Псалми',
  'Приповісті',
  'Екклезіяст',
  'Пісня над піснями',
  'Ісая',
  'Єремія',
  'Плач Єремії',
  'Єзекіїль',
  'Даниїл',
  'Осія',
  'Йоіл',
  'Амос',
  'Овдій',
  'Йона',
  'Михей',
  'Наум',
  'Авакум',
  'Софонія',
  'Огій',
  'Захарія',
  'Малахія',
  'Від Матвія',
  'Від Марка',
  'Від Луки',
  'Від Івана',
  'Дії апостолів',
  'До римлян',
  '1 до коринтян',
  '2 до коринтян',
  'До галатів',
  'До ефесян',
  'До филип’ян',
  'До колоссян',
  '1 до солунян',
  '2 до солунян',
  '1 до Тимофія',
  '2 до Тимофія',
  'До Тита',
  'До Филимона',
  'До євреїв',
  'Якова',
  '1 Петра',
  '2 Петра',
  '1 Івана',
  '2 Івана',
  '3 Івана',
  'Юди',
  'Об’явлення',
];

export function bookNameUk(bookId: number): string {
  return BOOK_NAMES_UK[bookId] || `книга ${bookId}`;
}

/** "Буття–Повторення Закону" style ranges for a sorted id list — compact enough for a prompt. */
export function describeBooks(bookIds: readonly number[]): string {
  const ids = [...new Set(bookIds)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < ids.length; ) {
    let j = i;
    while (j + 1 < ids.length && ids[j + 1] === ids[j] + 1) j += 1;
    parts.push(j - i >= 2 ? `${bookNameUk(ids[i])}–${bookNameUk(ids[j])}` : ids.slice(i, j + 1).map(bookNameUk).join(', '));
    i = j + 1;
  }
  return parts.join(', ');
}
