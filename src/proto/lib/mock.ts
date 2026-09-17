/**
 * Prototype fixtures. Shaped like the Phase 3 learning domain (plan → module →
 * objective → lesson → practice) so the screens can later be pointed at
 * `/api/v1/learning/*` without reshaping the UI.
 */

export type PlanId = 'luke' | 'psalms' | 'genesis';

export interface PlanSummary {
  id: PlanId;
  title: string;
  subtitle: string;
  book: string;
  hue: number;
  modulesTotal: number;
  modulesDone: number;
  minutesPerDay: number;
}

export interface ModuleSummary {
  id: string;
  planId: PlanId;
  title: string;
  objectives: number;
  minutes: number;
  state: 'done' | 'active' | 'locked';
  mastery: number;
}

export type LessonBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'scripture'; reference: string; text: string }
  | { kind: 'insight'; title: string; text: string }
  | { kind: 'figure'; caption: string; hue: number }
  | { kind: 'checkpoint'; question: string; options: string[]; correct: number; why: string };

export interface Lesson {
  id: string;
  planId: PlanId;
  moduleTitle: string;
  title: string;
  reference: string;
  minutes: number;
  blocks: LessonBlock[];
}

export interface PracticeQuestion {
  id: string;
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
  reference: string;
  theme: string;
}

export const PLANS: PlanSummary[] = [
  {
    id: 'luke',
    title: 'Євангеліє від Луки',
    subtitle: 'Притчі, зцілення й дорога до Єрусалима',
    book: 'Новий Завіт',
    hue: 258,
    modulesTotal: 12,
    modulesDone: 5,
    minutesPerDay: 7,
  },
  {
    id: 'psalms',
    title: 'Псалми надії',
    subtitle: 'Тридцять днів молитви разом із Давидом',
    book: 'Старий Завіт',
    hue: 205,
    modulesTotal: 30,
    modulesDone: 11,
    minutesPerDay: 5,
  },
  {
    id: 'genesis',
    title: 'Книга Буття',
    subtitle: 'Початок, завіт і родина обітниці',
    book: 'Старий Завіт',
    hue: 32,
    modulesTotal: 16,
    modulesDone: 0,
    minutesPerDay: 9,
  },
];

export const MODULES: ModuleSummary[] = [
  { id: 'luke-1', planId: 'luke', title: 'Народження та дитинство', objectives: 4, minutes: 6, state: 'done', mastery: 0.92 },
  { id: 'luke-2', planId: 'luke', title: 'Хрещення й пустеля', objectives: 3, minutes: 5, state: 'done', mastery: 0.88 },
  { id: 'luke-3', planId: 'luke', title: 'Перші учні', objectives: 5, minutes: 8, state: 'done', mastery: 0.76 },
  { id: 'luke-4', planId: 'luke', title: 'Нагірна проповідь', objectives: 6, minutes: 9, state: 'done', mastery: 0.71 },
  { id: 'luke-5', planId: 'luke', title: 'Зцілення в Капернаумі', objectives: 4, minutes: 6, state: 'done', mastery: 0.64 },
  { id: 'luke-6', planId: 'luke', title: 'Притчі про Царство', objectives: 5, minutes: 7, state: 'active', mastery: 0.28 },
  { id: 'luke-7', planId: 'luke', title: 'Хліб для п’яти тисяч', objectives: 4, minutes: 6, state: 'locked', mastery: 0 },
  { id: 'luke-8', planId: 'luke', title: 'Дорога до Єрусалима', objectives: 6, minutes: 10, state: 'locked', mastery: 0 },
];

export const TODAY_LESSON: Lesson = {
  id: 'luke-6-sower',
  planId: 'luke',
  moduleTitle: 'Притчі про Царство',
  title: 'Притча про сіяча',
  reference: 'Луки 8:4–15',
  minutes: 6,
  blocks: [
    {
      kind: 'paragraph',
      text: 'Юрба йшла за Ісусом із кожного міста. Замість прямої настанови Він розповів історію, яку розумів кожен, хто хоч раз тримав у руках зерно. Притча не ховає істину — вона перевіряє, наскільки уважно ми слухаємо.',
    },
    {
      kind: 'scripture',
      reference: 'Луки 8:5',
      text: 'Вийшов сіяч сіяти зерно своє. І коли він сіяв, одне впало край дороги і було потоптане, і птахи небесні його повидзьобували.',
    },
    {
      kind: 'insight',
      title: 'Ключова думка',
      text: 'Сіяч один, зерно одне — різний лише ґрунт. Притча говорить не про якість слова, а про стан серця, яке його приймає.',
    },
    {
      kind: 'paragraph',
      text: 'Чотири ґрунти — це чотири способи зустріти те саме слово: неуважність край дороги, поверхневий захват на камені, задушене турботами зерно серед тернини та терпеливість доброї землі.',
    },
    {
      kind: 'figure',
      caption: 'Чотири ґрунти з притчі — дорога, каміння, терня, добра земля',
      hue: 258,
    },
    {
      kind: 'checkpoint',
      question: 'Що, за поясненням Ісуса, означає зерно в притчі?',
      options: ['Слово Боже', 'Ізраїльський народ', 'Учні Христа', 'Царство небесне'],
      correct: 0,
      why: '«А зерно — це Боже Слово» (Луки 8:11). Ґрунти ж — це різні стани серця, яке це слово чує.',
    },
    {
      kind: 'paragraph',
      text: 'Добра земля не означає легке життя. Лука додає слово «терпеливість»: плід визріває в тих, хто тримається слова довше, ніж триває перше натхнення.',
    },
  ],
};

export const PRACTICE_QUESTIONS: PracticeQuestion[] = [
  {
    id: 'q1',
    prompt: 'У якому місті народився Ісус?',
    options: ['Назарет', 'Вифлеєм', 'Капернаум', 'Єрусалим'],
    correct: 1,
    explanation: 'Ісус народився у Вифлеємі Юдейському, а виріс у Назареті — звідси й ім’я «Ісус із Назарета».',
    reference: 'Луки 2:4–7',
    theme: 'Євангелія',
  },
  {
    id: 'q2',
    prompt: 'Хто з учнів тричі зрікся Ісуса перед світанком?',
    options: ['Тома', 'Юда', 'Петро', 'Яків'],
    correct: 2,
    explanation: 'Петро зрікся тричі, перш ніж заспівав півень, — і згодом саме йому Христос тричі довірив пасти овець.',
    reference: 'Луки 22:54–62',
    theme: 'Євангелія',
  },
  {
    id: 'q3',
    prompt: 'Скільки днів Ісус постився в пустелі?',
    options: ['7', '12', '40', '70'],
    correct: 2,
    explanation: 'Сорок днів посту перегукуються з сорока роками Ізраїлю в пустелі та сорока днями Мойсея на горі.',
    reference: 'Луки 4:1–2',
    theme: 'Євангелія',
  },
  {
    id: 'q4',
    prompt: 'Хто вивів народ Ізраїлю з єгипетського рабства?',
    options: ['Авраам', 'Мойсей', 'Ісус Навин', 'Самуїл'],
    correct: 1,
    explanation: 'Мойсей вивів народ з Єгипту, а Ісус Навин уже після нього ввів його в обіцяну землю.',
    reference: 'Вихід 12:31–42',
    theme: 'П’ятикнижжя',
  },
  {
    id: 'q5',
    prompt: 'Яка книга Біблії найдовша за кількістю розділів?',
    options: ['Буття', 'Ісаї', 'Псалми', 'Об’явлення'],
    correct: 2,
    explanation: 'У Псалмах 150 розділів — більше, ніж у будь-якій іншій книзі Біблії.',
    reference: 'Псалми 1–150',
    theme: 'Поетичні книги',
  },
  {
    id: 'q6',
    prompt: 'Хто хрестив Ісуса в Йордані?',
    options: ['Іван Хреститель', 'Апостол Петро', 'Пророк Ілля', 'Апостол Андрій'],
    correct: 0,
    explanation: 'Іван Хреститель охрестив Ісуса, хоч і казав, що не гідний розв’язати ремінця Його взуття.',
    reference: 'Луки 3:21–22',
    theme: 'Євангелія',
  },
  {
    id: 'q7',
    prompt: 'Кому Бог дав десять заповідей на горі Сінай?',
    options: ['Ноєві', 'Мойсею', 'Давидові', 'Соломону'],
    correct: 1,
    explanation: 'Мойсей отримав заповіді на Сінаї на двох кам’яних таблицях.',
    reference: 'Вихід 20:1–17',
    theme: 'П’ятикнижжя',
  },
  {
    id: 'q8',
    prompt: 'Яка перша книга Біблії?',
    options: ['Вихід', 'Буття', 'Йова', 'Псалми'],
    correct: 1,
    explanation: 'Буття відкриває і Тору, і всю Біблію словами «На початку Бог створив небо і землю».',
    reference: 'Буття 1:1',
    theme: 'П’ятикнижжя',
  },
];

export const VERSE_OF_DAY = {
  text: 'Твоє слово — світильник для моєї ноги і світло для моєї стежки.',
  reference: 'Псалом 119:105',
};

export const REVIEW_DUE = 8;

export const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

/** The prototype's fixed "today" — a Thursday, so the week always looks mid-run. */
export const TODAY_DATE = { year: 2026, month: 8, day: 17 }; // month is 0-based

/**
 * Three full Mon–Sun weeks ending with the current one. Index 0 is Monday,
 * 31 Aug 2026; the value is how many sessions that day held.
 */
export const ACTIVITY_START = { year: 2026, month: 7, day: 31 };
export const ACTIVITY: number[] = [
  2, 3, 0, 4, 5, 1, 3, // 31 сер – 6 вер
  4, 4, 0, 2, 5, 5, 3, // 7–13 вер
  4, 2, 0, 3, 0, 0, 0, // 14–20 вер (18–20 ще попереду)
];

export const MASTERY_BY_THEME = [
  { theme: 'Євангелія', value: 0.78 },
  { theme: 'П’ятикнижжя', value: 0.61 },
  { theme: 'Поетичні книги', value: 0.44 },
  { theme: 'Пророки', value: 0.23 },
  { theme: 'Послання', value: 0.12 },
];

export const ACHIEVEMENTS = [
  { id: 'a1', title: 'Сім днів поспіль', icon: 'flame', earned: true },
  { id: 'a2', title: 'Перший план', icon: 'book', earned: true },
  { id: 'a3', title: '100 відповідей', icon: 'target', earned: true },
  { id: 'a4', title: 'Без помилок', icon: 'sparkles', earned: false },
  { id: 'a5', title: 'Нічний читач', icon: 'moon', earned: false },
];

export const GAMES = [
  {
    id: 'millionaire',
    title: 'Мільйонер',
    tagline: 'П’ятнадцять питань, три підказки',
    hue: 268,
    players: '1 гравець',
    ready: true,
  },
  {
    id: 'survival',
    title: 'Виживання',
    tagline: 'Три життя — і жодної помилки більше',
    hue: 348,
    players: '1 гравець',
    ready: true,
  },
  {
    id: 'kahoot',
    title: 'Жива вікторина',
    tagline: 'Кімната з кодом для групи',
    hue: 168,
    players: 'до 40 гравців',
    ready: false,
  },
  {
    id: 'challenge',
    title: 'Виклик другові',
    tagline: 'Асинхронний поєдинок на 10 питань',
    hue: 38,
    players: '2 гравці',
    ready: false,
  },
];

/* ------------------------------------------------------- iteration 2 fixtures */

/** Millionaire ladder — coins, with the three guaranteed steps marked. */
export const LADDER = [
  { level: 1, prize: 10 },
  { level: 2, prize: 20 },
  { level: 3, prize: 40 },
  { level: 4, prize: 80 },
  { level: 5, prize: 150, safe: true },
  { level: 6, prize: 250 },
  { level: 7, prize: 400 },
  { level: 8, prize: 600 },
  { level: 9, prize: 900 },
  { level: 10, prize: 1300, safe: true },
  { level: 11, prize: 1800 },
  { level: 12, prize: 2500 },
  { level: 13, prize: 3500 },
  { level: 14, prize: 5000 },
  { level: 15, prize: 8000, safe: true },
];

export interface ModuleObjective {
  id: string;
  title: string;
  mastery: number;
}

export interface ModuleLesson {
  id: string;
  title: string;
  reference: string;
  minutes: number;
  state: 'done' | 'active' | 'locked';
}

export const MODULE_DETAIL = {
  summary:
    'Чотири притчі, у яких Ісус пояснює, як діє Царство: непомітно, поступово і завжди через серце, що слухає.',
  objectives: [
    { id: 'o1', title: 'Назвати чотири ґрунти й що вони означають', mastery: 0.62 },
    { id: 'o2', title: 'Пояснити, чому Ісус говорив притчами', mastery: 0.3 },
    { id: 'o3', title: 'Знайти паралельні місця в Матвія і Марка', mastery: 0.12 },
    { id: 'o4', title: 'Переказати притчу про гірчичне зерно', mastery: 0 },
    { id: 'o5', title: 'Застосувати притчу до власного тижня', mastery: 0 },
  ] as ModuleObjective[],
  lessons: [
    { id: 'l1', title: 'Притча про сіяча', reference: 'Луки 8:4–15', minutes: 6, state: 'active' },
    { id: 'l2', title: 'Світильник під посудиною', reference: 'Луки 8:16–18', minutes: 4, state: 'locked' },
    { id: 'l3', title: 'Гірчичне зерно і закваска', reference: 'Луки 13:18–21', minutes: 5, state: 'locked' },
    { id: 'l4', title: 'Перевірка модуля', reference: '10 запитань', minutes: 7, state: 'locked' },
  ] as ModuleLesson[],
};

export const KAHOOT_PLAYLISTS = [
  { id: 'k1', title: 'Різдвяна вікторина', questions: 18, plays: 42, hue: 168 },
  { id: 'k2', title: 'Життя апостола Павла', questions: 24, plays: 17, hue: 268 },
  { id: 'k3', title: 'Молодіжна група · вересень', questions: 12, plays: 8, hue: 38 },
];

export const KAHOOT_ROOM = {
  code: '482 915',
  playlist: 'Різдвяна вікторина',
  players: [
    { id: 'p1', name: 'Марія', ready: true },
    { id: 'p2', name: 'Олег', ready: true },
    { id: 'p3', name: 'Софія', ready: false },
    { id: 'p4', name: 'Тарас', ready: true },
    { id: 'p5', name: 'Іван', ready: false },
    { id: 'p6', name: 'Анна', ready: true },
  ],
};

export const CHALLENGES = [
  {
    id: 'c1',
    opponent: 'Олег',
    topic: 'Євангелія',
    myScore: 7,
    theirScore: 5,
    state: 'your-turn' as const,
    endsIn: '11 год',
  },
  {
    id: 'c2',
    opponent: 'Марія',
    topic: 'П’ятикнижжя',
    myScore: 6,
    theirScore: 6,
    state: 'waiting' as const,
    endsIn: '2 дні',
  },
  {
    id: 'c3',
    opponent: 'Софія',
    topic: 'Псалми',
    myScore: 9,
    theirScore: 4,
    state: 'won' as const,
    endsIn: 'завершено',
  },
];

export const COMMUNITIES = [
  { id: 'g1', title: 'Молодіжна група «Джерело»', members: 24, hue: 258, role: 'Учасник', weekly: 1820 },
  { id: 'g2', title: 'Домашня група · четвер', members: 9, hue: 168, role: 'Лідер', weekly: 940 },
];

export const LEADERBOARD = [
  { id: 'u1', name: 'Марія К.', xp: 2410, you: false },
  { id: 'u2', name: 'Денис', xp: 2012, you: true },
  { id: 'u3', name: 'Олег П.', xp: 1870, you: false },
  { id: 'u4', name: 'Софія Л.', xp: 1640, you: false },
  { id: 'u5', name: 'Тарас М.', xp: 1180, you: false },
];

export const SHOP_SECTIONS = [
  {
    id: 'themes',
    title: 'Оформлення',
    note: 'лише вигляд',
    items: [
      { id: 's1', title: 'Море', subtitle: 'Кольорова тема', price: 150, hue: 198, owned: false },
      { id: 's2', title: 'Олива', subtitle: 'Кольорова тема', price: 150, hue: 96, owned: false },
      { id: 's3', title: 'Світанок', subtitle: 'Кольорова тема', price: 150, hue: 28, owned: true },
    ],
  },
  {
    id: 'helpers',
    title: 'Помічники',
    note: 'лише в іграх',
    items: [
      { id: 's4', title: '5 підказок', subtitle: 'Для «Мільйонера»', price: 90, hue: 268, owned: false },
      { id: 's5', title: 'Друге життя', subtitle: 'Для «Виживання»', price: 120, hue: 348, owned: false },
    ],
  },
];
