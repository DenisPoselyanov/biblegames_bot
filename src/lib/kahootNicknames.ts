/** Random biblical-style nicknames for Kahoot join */
const NICKNAMES = [
  'Давид', 'Мойсей', 'Рут', 'Естер', 'Павло', 'Петро', 'Марія', 'Іван',
  'Самуїл', 'Даниїл', 'Ной', 'Авраам', 'Сара', 'Рахиль', 'Левій', 'Аарон',
  'Гедеон', 'Дебора', 'Елія', 'Наомі', 'Варвара', 'Стефан', 'Тимофій', 'Лука',
  'Віфлеєм', 'Сіон', 'Голгофа', 'Єрусалим', 'Галилея', 'Назарет',
];

export function randomKahootNickname(): string {
  const base = NICKNAMES[Math.floor(Math.random() * NICKNAMES.length)]!;
  const suffix = Math.floor(Math.random() * 90) + 10;
  return `${base}${suffix}`;
}
