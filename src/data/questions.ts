import type { Difficulty, PracticeTrackProgress, Question, TopicNode } from '../types';
import { QUESTIONS_PER_LEVEL } from '../types';
import { PRACTICE_QUESTIONS_PER_STAGE } from '../lib/practiceProgression';
import { EXTRA_QUESTIONS } from './questions-extra';
import exclusionsJson from '../../data/question-exclusions.json';
import overridesJson from '../../data/question-overrides.json';

type TopicTag = { topicNodeId: string; topicPath?: string };

function loadEmbeddedTopicTags(): Record<string, TopicTag> {
  if (typeof import.meta.glob === 'function') {
    const modules = import.meta.glob('../../data/question-topic-tags.json', {
      eager: true,
      import: 'default',
    });
    return (Object.values(modules)[0] as Record<string, TopicTag> | undefined) ?? {};
  }
  return {};
}

const EMBEDDED_TOPIC_TAGS = loadEmbeddedTopicTags();
const EXCLUDED_QUESTION_IDS = new Set<string>(
  Array.isArray(exclusionsJson) ? exclusionsJson : [],
);
const QUESTION_OVERRIDES = (overridesJson ?? {}) as Record<string, Partial<Question>>;

function applyDiskMutations(questions: Question[]): Question[] {
  return questions
    .filter((q) => !EXCLUDED_QUESTION_IDS.has(q.id))
    .map((q) => {
      const patch = QUESTION_OVERRIDES[q.id];
      if (!patch) return q;
      return { ...q, ...patch, id: q.id };
    });
}

function withEmbeddedTopicTags(question: Question): Question {
  const tag = EMBEDDED_TOPIC_TAGS[question.id];
  if (!tag?.topicNodeId) return question;
  return {
    ...question,
    topicNodeId: tag.topicNodeId,
    topicPath: tag.topicPath,
  };
}

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function q(
  themeId: string,
  difficulty: Difficulty,
  n: number,
  text: string,
  options: string[],
  correctIndex: number,
  reference?: string,
): Question {
  return {
    id: `${themeId}-${difficulty}-${n}`,
    themeId,
    difficulty,
    text,
    options,
    correctIndex,
    reference,
  };
}

export const QUESTIONS: Question[] = [
  // Географія Старого Завіту
  q('geography', 'child', 3, 'Яке море розступилось перед Ізраїлем?', ['Червоне', 'Мертве', 'Галилейське', 'Середземне'], 0, 'Вих. 14:21'),
  q('geography', 'child', 4, 'У якій країні був полонений Йосиф?', ['Єгипет', 'Вавилон', 'Ассирія', 'Персія'], 0, 'Бут. 37:28'),
  q('geography', 'youth', 2, 'Де Ілля переміг пророків Ваала?', ['Карміл', 'Синай', 'Хорив', 'Сіон'], 0, '3 Цар. 18:19'),
  q('geography', 'youth', 3, 'Яка річка текла через Едем?', ['Євфрат (разом з іншими)', 'Ніл', 'Йордан', 'Кедрон'], 0, 'Бут. 2:10-14'),
  q('geography', 'student', 1, 'Яке місто зруйнував Ісус Навин після сурми?', ['Єрихон', 'Аї', 'Гаваон', 'Лахіс'], 0, 'Нав. 6:20'),

  // Географія Нового Завіту
  q('geography-nt', 'child', 1, 'У якій річці Іоанн хрестив?', ['Йордан', 'Ніл', 'Євфрат', 'Тигр'], 0, 'Мат. 3:6'),
  q('geography-nt', 'child', 2, 'Де народився Ісус?', ['Віфлеєм', 'Назарет', 'Єрусалим', 'Капернаум'], 0, 'Лк. 2:4-7'),
  q('geography-nt', 'child', 5, 'Де проповідував Павло на Ареопазі?', ['Афіни', 'Рим', 'Коринф', 'Ефес'], 0, 'Дії 17:22'),
  q('geography-nt', 'youth', 4, 'Куди був вигнаний Іоанн за відкриття?', ['Патмос', 'Крит', 'Кіпр', 'Мальта'], 0, 'Одкр. 1:9'),
  q('geography-nt', 'youth', 5, 'Де зустрів Ісус самарянку?', ['Сихар', 'Самарія', 'Ієрихон', 'Еммаус'], 0, 'Ін. 4:5'),
  q('geography-nt', 'student', 2, 'Де Павло зустрів Лідію?', ['Филипи', 'Троада', 'Ассос', 'Мілет'], 0, 'Дії 16:14'),
  q('geography-nt', 'student', 3, 'Яка гора — місце вознесіння Ісуса?', ['Олива', 'Синай', 'Сіон', 'Карміл'], 0, 'Дії 1:12'),
  q('geography-nt', 'student', 4, 'Де був ув’язнений Павло з Силою?', ['Филипи', 'Рим', 'Кесарія', 'Єрусалим'], 0, 'Дії 16:23'),
  q('geography-nt', 'student', 5, 'Яке озеро називали Геннісаретським?', ['Галилейське', 'Мертве', 'Тіверіадське', 'Солоне'], 0, 'Мат. 14:34'),

  // Старий Завіт
  q('old-testament', 'child', 4, 'Яке ім’я отримав Яків після боротьби з Богом?', ['Ізраїль', 'Авраам', 'Ісав', 'Валаам'], 0, 'Бут. 32:28'),
  q('old-testament', 'youth', 2, 'Скільки років жили патріархи до потопу (орієнтовно)?', ['Сотні років', '70 років', '50 років', '30 років'], 0, 'Бут. 5'),
  q('old-testament', 'youth', 3, 'Хто був «людиною за серцем Божим»?', ['Давид', 'Соломон', 'Саул', 'Езекія'], 0, 'Дії 13:22'),
  q('old-testament', 'youth', 4, 'Яку книгу написав Соломон про мудрість?', ['Притчі', 'Псалми', 'Вихід', 'Суддів'], 0, 'Прит. 1:1'),
  q('old-testament', 'youth', 5, 'Хто був «батьком багатьох народів»?', ['Авраам', 'Ной', 'Мойсей', 'Ісав'], 0, 'Бут. 17:5'),

  // Закон Мойсея
  q('mosaic-law', 'child', 1, 'Скільки заповідей на кам’яних скрижалях?', ['10', '7', '12', '613'], 0, 'Вих. 20'),
  q('mosaic-law', 'child', 2, 'Яке свято згадує вихід з Єгипту?', ['Пасха', 'Труби', 'Кущі', 'Завіщення'], 0, 'Вих. 12'),
  q('mosaic-law', 'child', 3, 'Хто отримав Закон на горі?', ['Мойсей', 'Аарон', 'Ісус Навин', 'Самуїл'], 0, 'Вих. 19:20'),
  q('mosaic-law', 'child', 4, 'Що не можна робити в суботу?', ['Працювати', 'Молитися', 'Читати', 'Їсти'], 0, 'Вих. 20:10'),
  q('mosaic-law', 'child', 5, 'Яка скотина була «жертвою за гріх»?', ['Козел / ягня', 'Голуб', 'Риба', 'Хліб'], 0, 'Лев. 4'),
  q('mosaic-law', 'youth', 2, 'Який рік — прощення боргів?', ['Ювілейний', 'Суботній', 'Святковий', 'Врожайний'], 0, 'Лев. 25'),
  q('mosaic-law', 'youth', 4, 'Що було на ковчезі завіту?', ['Херувими', 'Агнці', 'Зірки', 'Хрест'], 0, 'Вих. 25:18'),
  q('mosaic-law', 'youth', 5, 'Яке місто — «місто притулку»?', ['Города-втечі', 'Єрусалим', 'Сихем', 'Віфлеєм'], 0, 'Чис. 35'),
  q('mosaic-law', 'student', 1, 'Скільки книг у Торі (Пентатеух)?', ['5', '4', '12', '39'], 0),
  q('mosaic-law', 'student', 4, 'Яка жертва — «цілопалення»?', ['Ольта', 'Хліб', 'Пити', 'Мир'], 0, 'Лев. 1'),
  q('mosaic-law', 'student', 5, 'Що забороняла третя заповідь?', ['Легкомовність імені Бога', 'Крадіжку', 'Брехню', 'Зависть'], 0, 'Вих. 20:7'),

  // Апостол Павло
  q('paul', 'child', 1, 'Як звали Павла до навернення?', ['Савл', 'Симон', 'Варнава', 'Тимофій'], 0, 'Дії 13:9'),
  q('paul', 'child', 3, 'Хто був учителем Павла?', ['Гамаліїл', 'Петро', 'Іоанн', 'Андрій'], 0, 'Дії 22:3'),
  q('paul', 'child', 4, 'Скільки листів Павла в Новому Завіті (традиційно)?', ['13', '7', '21', '4'], 0),
  q('paul', 'child', 5, 'Кого Павло називав «улюбленим сином»?', ['Тимофія', 'Тита', 'Луку', 'Марка'], 0, '1 Тим. 1:2'),
  q('paul', 'youth', 2, 'Де Павло написав про «любов — терпить»?', ['1 Кор. 13', 'Рим. 8', 'Гал. 5', 'Еф. 6'], 0),
  q('paul', 'youth', 3, 'Хто супроводжував Павла в першій подорожі?', ['Варнава', 'Петро', 'Іоанн', 'Яків'], 0, 'Дії 13:2'),
  q('paul', 'youth', 4, 'У якій в’язниці писав листи до филип’ян?', ['Рим', 'Єрусалим', 'Кесарія', 'Коринф'], 0, 'Флп. 1:7'),
  q('paul', 'youth', 5, 'Що Павло називав «шоломом спасіння»?', ['Слово Боже / віра', 'Меч', 'Щит', 'Пояс'], 0, 'Еф. 6:17'),
  q('paul', 'student', 2, 'Хто відрізав вухо слузі первосвященика?', ['Петро', 'Павло', 'Іоанн', 'Андрій'], 0, 'Ін. 18:10'),
  q('paul', 'student', 3, 'Яке місто — «ворота до Європи» для Павла?', ['Филипи', 'Афіни', 'Рим', 'Коринф'], 0, 'Дії 16:12'),
  q('paul', 'student', 4, 'Про що сперечалися в Антіохії?', ['Обрізання язичників', 'Храм', 'Пост', 'Десятина'], 0, 'Дії 15'),

  // Судді
  q('judges', 'child', 1, 'Хто вбив тисячу филистимлян ослиною щелепою?', ['Самсон', 'Гедеон', 'Єфта', 'Девора'], 0, 'Суд. 15:15'),
  q('judges', 'child', 2, 'Хто переміг Мадіанітів з 300 воїнами?', ['Гедеон', 'Самсон', 'Авімелех', 'Офніїл'], 0, 'Суд. 7:7'),
  q('judges', 'child', 3, 'Хто був «суддею та пророчицею» під деревом?', ['Девора', 'Рут', 'Естер', 'Юдіф'], 0, 'Суд. 4:4'),
  q('judges', 'child', 4, 'Звідки була сила Самсона?', ['Волосся (назарейство)', 'Меч', 'Богатство', 'Молитва'], 0, 'Суд. 16:17'),
  q('judges', 'child', 5, 'Хто приніс у жертву дочку?', ['Єфта', 'Гедеон', 'Самсон', 'Авімелех'], 0, 'Суд. 11:30'),
  q('judges', 'youth', 1, 'Скільки років суддів було приблизно?', ['Близько 300', '40', '70', '1000'], 0),
  q('judges', 'youth', 2, 'Хто вбив Еглона, царя Моава?', ['Еhуд', 'Самсон', 'Гедеон', 'Офніїл'], 0, 'Суд. 3:21'),
  q('judges', 'youth', 3, 'Яка жінка зрадила Самсона?', ['Даліла', 'Рут', 'Саскі', 'Агар'], 0, 'Суд. 16:4'),
  q('judges', 'youth', 4, 'Хто був першим суддею Ізраїля?', ['Офніїл', 'Гедеон', 'Самуїл', 'Самсон'], 0, 'Суд. 3:9'),
  q('judges', 'youth', 5, 'Що означає «кожен робив, що праве в очах його»?', ['Анархія без царя', 'Мир', 'Закон', 'Храм'], 0, 'Суд. 21:25'),
  q('judges', 'student', 2, 'Скільки років поневолення перед Самсоном (одне з)?', ['40', '7', '12', '20'], 0, 'Суд. 13:1'),
  q('judges', 'student', 3, 'Хто написав пісню про перемогу над Сісерою?', ['Девора', 'Рут', 'Міріам', 'Анна'], 0, 'Суд. 5'),
  q('judges', 'student', 4, 'Яке плем’я дало перших суддів?', ['Юда / Веніамін', 'Єфрем', 'Дан', 'Нефталим'], 0),
  q('judges', 'student', 5, 'Хто був останнім «суддею» перед царями?', ['Самуїл', 'Самсон', 'Єлі', 'Авімелех'], 0, '1 Цар. 7:15'),

  // Царі
  q('kings', 'child', 1, 'Хто був другим царем Ізраїля?', ['Давид', 'Саул', 'Соломон', 'Реховам'], 0, '1 Цар. 16'),
  q('kings', 'child', 2, 'Хто збудував храм у Єрусалимі?', ['Соломон', 'Давид', 'Єзекія', 'Йосія'], 0, '3 Цар. 6'),
  q('kings', 'child', 3, 'Хто був «наймудрішим» царем?', ['Соломон', 'Саул', 'Ахав', 'Озія'], 0, '3 Цар. 4:30'),
  q('kings', 'child', 4, 'Хто був батьком Соломона?', ['Давид', 'Саул', 'Єссей', 'Самуїл'], 0, '2 Цар. 12:24'),
  q('kings', 'child', 5, 'Скільки племен мало Ізраїль після розколу?', ['12 північ / 2 південь', '10 / 2', '7 / 5', '1 / 11'], 0),
  q('kings', 'youth', 2, 'Який цар поклонявся Ваалу з Ієзавеллю?', ['Ахав', 'Озія', 'Манасія', 'Саул'], 0, '3 Цар. 16:31'),
  q('kings', 'youth', 3, 'Хто відновив храм і святкував Пасху?', ['Єзекія / Йосія', 'Ахаз', 'Манасія', 'Саул'], 0),
  q('kings', 'youth', 4, 'Скільки років правив Давид?', ['40', '7', '12', '70'], 0, '2 Цар. 5:4'),
  q('kings', 'youth', 5, 'Хто був «царем Вавилону» під час вигнання?', ['Навуходоносор', 'Кір', 'Дарій', 'Артаксеркс'], 0),
  q('kings', 'student', 1, 'Хто був «царем півночі» після розколу?', ['Єрубоам', 'Реховам', 'Авія', 'Аса'], 0, '3 Цар. 12:20'),
  q('kings', 'student', 2, 'Який цар отримав 15 років життя за молитву?', ['Єзекія', 'Манасія', 'Йосія', 'Озія'], 0, '4 Цар. 20:6'),
  q('kings', 'student', 3, 'Хто був «царем праведним як Давид»?', ['Йосія', 'Ахаз', 'Саул', 'Ахав'], 0, '4 Цар. 22:2'),
  q('kings', 'student', 4, 'Скільки дружин і наложниць мав Соломон (орієнтовно)?', ['700 + 300', '1', '12', '40'], 0, '3 Цар. 11:3'),
  q('kings', 'student', 5, 'Хто був останнім царем Юдеї перед вигнанням?', ['Седекія', 'Йоахаз', 'Єгояким', 'Манасія'], 0, '4 Цар. 25'),

  // Новий Завіт
  q('new-testament', 'youth', 2, 'Яка книга — «католичні листи»?', ['Яків, 1-2 Петра, Іуда', 'Римлянам', 'Дії', 'Одкровення'], 0),
  q('new-testament', 'student', 4, 'Яка книга описує подорожі Павла?', ['Дії апостолів', 'Римлянам', 'Галатам', 'Коринфянам'], 0),

  // Євангелія
  q('gospels', 'child', 1, 'Скільки апостолів обрав Ісус?', ['12', '7', '70', '3'], 0, 'Мат. 10:2'),
  q('gospels', 'child', 2, 'Хто хрестив Ісуса?', ['Іоанн Хреститель', 'Петро', 'Анна', 'Захарія'], 0, 'Мат. 3:13'),
  q('gospels', 'child', 3, 'Що Ісус перетворив на вино?', ['Воду', 'Молоко', 'Олію', 'Кров'], 0, 'Ін. 2:9'),
  q('gospels', 'child', 4, 'Хто зрадив Ісуса за 30 срібників?', ['Іуда', 'Петро', 'Фома', 'Варфоломій'], 0, 'Мат. 26:15'),
  q('gospels', 'child', 5, 'Де Ісус молився перед арештом?', ['Гефсиманія', 'Сіон', 'Олива', 'Храм'], 0, 'Мат. 26:36'),
  q('gospels', 'youth', 1, 'Хто був «скептиком» серед апостолів?', ['Фома', 'Андрій', 'Іоанн', 'Яків'], 0, 'Ін. 20:25'),
  q('gospels', 'youth', 2, 'Скілько хлібів і риб нагодували 5000?', ['5 і 2', '7 і 3', '3 і 1', '12 і 7'], 0, 'Мат. 14:17'),
  q('gospels', 'youth', 3, 'Хто першим побачив воскреслого?', ['Марія Магдалина', 'Петро', 'Іоанн', 'Тома'], 0, 'Ін. 20:16'),
  q('gospels', 'youth', 4, 'Яке заповідання дав Ісус — «любіть одне одного»?', ['Нове заповідання', 'Старе', 'Десять', 'Мойсеєве'], 0, 'Ін. 13:34'),
  q('gospels', 'youth', 5, 'Хто був «каменем» церкви?', ['Петро', 'Павло', 'Іоанн', 'Яків'], 0, 'Мат. 16:18'),
  q('gospels', 'student', 1, 'Яке євангеліє починається з родоводу?', ['Матфея', 'Марка', 'Луки', 'Івана'], 0, 'Мат. 1'),
  q('gospels', 'student', 2, 'Хто був «любим учнем»?', ['Іоанн', 'Петро', 'Андрій', 'Яків'], 0, 'Ін. 13:23'),
  q('gospels', 'student', 3, 'Скільки днів Ісус був у гробі (традиційно)?', ['3', '1', '7', '40'], 0, 'Мат. 12:40'),
  q('gospels', 'student', 4, 'Де Ісус сказав «Я — хліб життя»?', ['Капернаум', 'Єрусалим', 'Самарія', 'Галилея'], 0, 'Ін. 6:35'),
  q('gospels', 'student', 5, 'Хто запитав «що правда?» у Пилата?', ['Пилат', 'Ірід', 'Первосвященик', 'Народ'], 0, 'Ін. 18:38'),

  // Пророки
  q('prophets', 'child', 1, 'Хто був «вогняним» пророком?', ['Ілля', 'Ісая', 'Єремія', 'Осія'], 0, '4 Цар. 1'),
  q('prophets', 'child', 2, 'Хто пророкував про «Діву зачне»?', ['Ісая', 'Єремія', 'Єзекіїль', 'Даниїл'], 0, 'Іс. 7:14'),
  q('prophets', 'child', 3, 'Хто був у печі левів?', ['Три друзі Даниїла', 'Даниїл', 'Іона', 'Ной'], 0, 'Дан. 3'),
  q('prophets', 'child', 4, 'Хто пророкував у роті риби?', ['Іона', 'Ілля', 'Амос', 'Михей'], 0, 'Йон. 2'),
  q('prophets', 'child', 5, 'Хто «плакавий пророк»?', ['Єремія', 'Ісая', 'Осія', 'Наум'], 0),
  q('prophets', 'youth', 1, 'Хто вознісся на вогненній колісниці?', ['Ілля', 'Енох', 'Мойсей', 'Ісая'], 0, '4 Цар. 2:11'),
  q('prophets', 'youth', 2, 'Хто бачив «сухі кості»?', ['Єзекіїль', 'Даниїл', 'Захарія', 'Малахія'], 0, 'Єзек. 37'),
  q('prophets', 'youth', 3, 'Хто пророкував 70 років вигнання?', ['Єремія', 'Ісая', 'Єзекіїль', 'Осія'], 0, 'Єр. 25:11'),
  q('prophets', 'youth', 4, 'Хто був «пророком у Вавилоні»?', ['Даниїл', 'Єзекіїль', 'Обадія', 'Агей'], 0),
  q('prophets', 'youth', 5, 'Хто закликав «наготу й сандалі»?', ['Ісая', 'Амос', 'Михей', 'Софонія'], 0, 'Іс. 20:2'),
  q('prophets', 'student', 1, 'Скільки «малих пророків»?', ['12', '4', '5', '16'], 0),
  q('prophets', 'student', 2, 'Хто пророкував про «Слугу Господнього»?', ['Ісая 53', 'Єремія', 'Осія', 'Малахія'], 0),
  q('prophets', 'student', 3, 'Хто був «пророком без честі на батьківщині»?', ['Ісус (цитата)', 'Ілля', 'Амос', 'Самуїл'], 0, 'Лк. 4:24'),
  q('prophets', 'student', 4, 'Який пророк — «книга втішення»?', ['Ісая (частково)', 'Амос', 'Наум', 'Овдій'], 0),
  q('prophets', 'student', 5, 'Хто останній пророк ВЗ?', ['Малахія', 'Захарія', 'Агей', 'Софонія'], 0),

  // Псалми
  q('wisdom-poetry', 'child', 1, 'Хто написав більшість псалмів?', ['Давид', 'Соломон', 'Мойсей', 'Асаф'], 0),
  q('wisdom-poetry', 'child', 2, 'Який псалм — «Господь пастир мій»?', ['23', '1', '51', '119'], 0, 'Пс. 22'),
  q('wisdom-poetry', 'child', 3, 'Скільки псалмів у книзі?', ['150', '100', '66', '12'], 0),
  q('wisdom-poetry', 'child', 4, 'Який псалм — покаяння Давида?', ['51', '23', '91', '150'], 0, 'Пс. 50'),
  q('wisdom-poetry', 'child', 5, 'Що означає «Алілуя»?', ['Хваліть Господа', 'Мир', 'Амінь', 'Слава'], 0),
  q('wisdom-poetry', 'youth', 1, 'Який найдовший псалм?', ['119', '23', '1', '150'], 0),
  q('wisdom-poetry', 'youth', 2, 'Хто написав псалом 90?', ['Мойсей', 'Давид', 'Соломон', 'Асаф'], 0, 'Пс. 89'),
  q('wisdom-poetry', 'youth', 3, 'Який псалм цитував Ісус на хресті?', ['22', '23', '51', '119'], 0, 'Мат. 27:46'),
  q('wisdom-poetry', 'youth', 4, 'Що таке «селаг»?', ['Пауза / музична позначка', 'Амінь', 'Кінець', 'Початок'], 0),
  q('wisdom-poetry', 'youth', 5, 'Який псалм — «блаженний муж»?', ['1', '23', '91', '150'], 0, 'Пс. 1'),
  q('wisdom-poetry', 'student', 1, 'Скільки розділів у псалмі 119 (за літерами)?', ['22', '12', '7', '40'], 0),
  q('wisdom-poetry', 'student', 2, 'Хто «співець царя»?', ['Давид', 'Асаф', 'Корех', 'Єфод'], 0),
  q('wisdom-poetry', 'student', 3, 'Який псалм — «не відступлю від тебе»?', ['16', '23', '51', '150'], 0, 'Пс. 15'),
  q('wisdom-poetry', 'student', 4, 'Що означає «Міхтам»?', ['Золотий / таємниця', 'Хвала', 'Скорбота', 'Перемога'], 0),
  q('wisdom-poetry', 'student', 5, 'Який псалм читають на Пасху (християни)?', ['22 / 23', '1', '150', '91'], 0),

  // Притчі
  q('parables', 'child', 1, 'Хто знайшов скарб у полі?', ['Людина, що продала все', 'Рибалка', 'Цар', 'Слуга'], 0, 'Мат. 13:44'),
  q('parables', 'child', 2, 'Скільки дівчат у притчі про весілля?', ['10', '5', '7', '12'], 0, 'Мат. 25:1'),
  q('parables', 'child', 3, 'Хто був «блудним сином»?', ['Молодший син', 'Старший', 'Слуга', 'Сусід'], 0, 'Лк. 15:11'),
  q('parables', 'child', 4, 'Що посіяв сіяч?', ['Слово', 'Золото', 'Хліб', 'Виноград'], 0, 'Мат. 13:3'),
  q('parables', 'child', 5, 'Хто допоміг «побитому»?', ['Самарянин', 'Священик', 'Левит', 'Фарисей'], 0, 'Лк. 10:33'),
  q('parables', 'youth', 1, 'Скільки талантів отримав третій слуга?', ['1', '5', '10', '2'], 0, 'Мат. 25:15'),
  q('parables', 'youth', 2, 'Що виросло серед пшениці?', ['Полин (пліви)', 'Виноград', 'Інжир', 'Оливи'], 0, 'Мат. 13:25'),
  q('parables', 'youth', 3, 'Хто просив хліба вночі?', ['Друг', 'Суддя', 'Цар', 'Священик'], 0, 'Лк. 11:5'),
  q('parables', 'youth', 4, 'Що знайшла жінка з 10 драхмами?', ['Одну', 'Десять', 'Сто', 'Жодної'], 0, 'Лк. 15:8'),
  q('parables', 'youth', 5, 'Хто «був багатим, а став бідним»?', ['Лазар і багатий', 'Сіяч', 'Рибалки', 'Виноградарі'], 0, 'Лк. 16:19'),
  q('parables', 'student', 1, 'Скільки притч у Матфея 13?', ['7', '3', '12', '1'], 0),
  q('parables', 'student', 2, 'Хто «продав усе» за перлину?', ['Купець', 'Рибалка', 'Цар', 'Син'], 0, 'Мат. 13:45'),
  q('parables', 'student', 3, 'Яка притча про «останню годину»?', ['Виноградарі', 'Сіяч', 'Корови', 'Риби'], 0, 'Мат. 20'),
  q('parables', 'student', 4, 'Хто «не мав вбрання весільного»?', ['Один гість', 'Усі', 'Цар', 'Слуги'], 0, 'Мат. 22:12'),
  q('parables', 'student', 5, 'Що означає «царство небесне подібне»?', ['Початок багатьох притч', 'Кінець', 'Закон', 'Суд'], 0),

  // Десять заповідей
  q('commandments', 'child', 1, 'Перша заповідь: не мати…', ['Інших богів', 'Ідолів', 'Батьків', 'Сусідів'], 0, 'Вих. 20:3'),
  q('commandments', 'child', 2, 'Пам’ятай день…', ['Суботи', 'Пасхи', 'Посту', 'Труб'], 0, 'Вих. 20:8'),
  q('commandments', 'child', 3, 'Не вбивай — це заповідь номер…', ['6', '1', '10', '5'], 0, 'Вих. 20:13'),
  q('commandments', 'child', 4, 'Шануй…', ['Батька і матір', 'Царя', 'Священика', 'Пророка'], 0, 'Вих. 20:12'),
  q('commandments', 'child', 5, 'Не бажай…', ['Дружини сусіда', 'Храму', 'Золота', 'Землі'], 0, 'Вих. 20:17'),
  q('commandments', 'youth', 1, 'Друга заповідь забороняє…', ['Ідоли', 'Крадіжку', 'Брехню', 'Перелюб'], 0, 'Вих. 20:4'),
  q('commandments', 'youth', 2, 'Де Мойсей отримав заповіді?', ['Синай', 'Сіон', 'Олива', 'Карміл'], 0, 'Вих. 19'),
  q('commandments', 'youth', 3, 'Скільки скрижалей?', ['2', '1', '10', '12'], 0, 'Вих. 31:18'),
  q('commandments', 'youth', 4, 'Хто розбив перші скрижалі?', ['Мойсей', 'Аарон', 'Народ', 'Ісус Навин'], 0, 'Вих. 32:19'),
  q('commandments', 'youth', 5, 'Яке заповідання Ісус дав як «найбільше»?', ['Любов до Бога і ближнього', 'Субота', 'Жертва', 'Піст'], 0, 'Мат. 22:37'),
  q('commandments', 'student', 1, 'У якому євангелії — «блаженні нищі духом» (не в 10 заповідях)?', ['Матфея 5', 'Вихід', 'Второзаконня', 'Левит'], 0),
  q('commandments', 'student', 2, 'Де повторені 10 заповідь?', ['Втор. 5', 'Бут. 1', 'Чис. 1', 'Нав. 1'], 0),
  q('commandments', 'student', 3, 'Що Ісус сказав про «закон до йота»?', ['Не минеться', 'Скасовано', 'Тільки любов', 'Нічого'], 0, 'Мат. 5:18'),
  q('commandments', 'student', 4, 'Яке заповідання — «не ложись»?', ['Не свідкуй неправдиво', 'Не кради', 'Не вбивай', 'Не чини перелюбу'], 0, 'Вих. 20:16'),
  q('commandments', 'student', 5, 'Хто написав заповіді «пальцем Божим»?', ['Бог', 'Мойсей', 'Ангели', 'Аарон'], 0, 'Вих. 31:18'),

  // Чудеса Ісуса
  q('miracles', 'child', 1, 'Кого воскресив Ісус у Лазарі?', ['Лазаря', 'Йоана', 'Діву', 'Симона'], 0, 'Ін. 11:43'),
  q('miracles', 'child', 2, 'Скільки прокажених очистив (один повернувся)?', ['10', '7', '12', '1'], 0, 'Лк. 17:12'),
  q('miracles', 'child', 3, 'Що Ісус зцілив у синагозі в суботу?', ['Руку суху', 'Сліпоту', 'Глухоту', 'Смерть'], 0, 'Мат. 12:10'),
  q('miracles', 'child', 4, 'Хто йшов по воді з Ісусом?', ['Петро', 'Іоанн', 'Яків', 'Андрій'], 0, 'Мат. 14:29'),
  q('miracles', 'child', 5, 'Що зцілив Ісус у Капернаумі — «службою»?', ['Слугу сотника', 'Царя', 'Священика', 'Свого брата'], 0, 'Мат. 8:5'),
  q('miracles', 'youth', 1, 'Скілько років жінці з кровотечею?', ['12', '7', '40', '3'], 0, 'Мк. 5:25'),
  q('miracles', 'youth', 2, 'Хто попросив тіла Ісуса для поховання?', ['Йосиф Ариматейський', 'Пилат', 'Петро', 'Іуда'], 0, 'Мат. 27:57'),
  q('miracles', 'youth', 3, 'Де Ісус зцілив сліпого від народження?', ['Силоам', 'Єрусалим', 'Єрихон', 'Назарет'], 0, 'Ін. 9:7'),
  q('miracles', 'youth', 4, 'Що Ісус прокляв — «ніхто не їв плоду»?', ['Смоковницю', 'Виноград', 'Оливу', 'Інжир'], 0, 'Мк. 11:14'),
  q('miracles', 'youth', 5, 'Скілько воскреслих згадано в Євангеліях (окрім Ісуса)?', ['3+', '1', '10', '0'], 0),
  q('miracles', 'student', 1, 'Хто дочка Іаіра?', ['12 років', '7 років', 'Немовля', 'Стариця'], 0, 'Мк. 5:42'),
  q('miracles', 'student', 2, 'Де Ісус нагодував 4000?', ['Декапол', 'Галилея', 'Юдея', 'Самарія'], 0, 'Мк. 8:1'),
  q('miracles', 'student', 3, 'Що Ісус зробив у храмі з торговцями?', ['Вигнав', 'Купив', 'Благословив', 'Навчав лише'], 0, 'Ін. 2:15'),
  q('miracles', 'student', 4, 'Хто сказав «тільки скажи слово»?', ['Сотник', 'Нікодим', 'Пилат', 'Ірод'], 0, 'Мат. 8:8'),
  q('miracles', 'student', 5, 'Яке чудо — «перше знамення» в Івана?', ['Вода в вино', 'Ходіння по воді', 'Воскресіння', 'Розмноження хлібів'], 0, 'Ін. 2:11'),

  // Патріархи
  q('patriarchs', 'child', 1, 'Хто був «батьком віри»?', ['Авраам', 'Ной', 'Адам', 'Мойсей'], 0, 'Рим. 4:11'),
  q('patriarchs', 'child', 2, 'Кого принесли в жертву на горі?', ['Ісака', 'Ісава', 'Якова', 'Йосифа'], 0, 'Бут. 22:2'),
  q('patriarchs', 'child', 3, 'Скільки синів мав Яків?', ['12', '7', '10', '2'], 0, 'Бут. 35:22'),
  q('patriarchs', 'child', 4, 'Хто продав брата в рабство?', ['Брати Йосифа', 'Ісав', 'Лаван', 'Фараон'], 0, 'Бут. 37:28'),
  q('patriarchs', 'child', 5, 'Яке ім’я дало Бог Аврааму раніше?', ['Аврам', 'Авраам', 'Сар', 'Ізраїль'], 0, 'Бут. 17:5'),
  q('patriarchs', 'youth', 1, 'Хто був «першою матір’ю обіцяного сина»?', ['Сара', 'Агар', 'Ревека', 'Лея'], 0, 'Бут. 21:2'),
  q('patriarchs', 'youth', 2, 'Хто обманув батька за благословення?', ['Яків', 'Ісав', 'Йосиф', 'Вениамін'], 0, 'Бут. 27:19'),
  q('patriarchs', 'youth', 3, 'Скільки років жив Мафусал?', ['969', '900', '175', '120'], 0, 'Бут. 5:27'),
  q('patriarchs', 'youth', 4, 'Хто був «пророком у дому фараона»?', ['Йосиф', 'Мойсей', 'Авраам', 'Даниїл'], 0, 'Бут. 41'),
  q('patriarchs', 'youth', 5, 'Де похований Авраам?', ['Махпела', 'Єрусалим', 'Сихем', 'Віфлеєм'], 0, 'Бут. 25:9'),
  q('patriarchs', 'student', 1, 'Хто був «першим, хто не побачив смерті»?', ['Енох', 'Ілля', 'Мойсей', 'Авраам'], 0, 'Бут. 5:24'),
  q('patriarchs', 'student', 2, 'Скільки років Аврааму при народженні Ісака?', ['100', '75', '90', '60'], 0, 'Бут. 21:5'),
  q('patriarchs', 'student', 3, 'Хто був «свояком» Авраама»?', ['Лот', 'Нахор', 'Авимелех', 'Авраам'], 0, 'Бут. 14:14'),
  q('patriarchs', 'student', 4, 'Який син Якова — «вовк»?', ['Вениамін / Іуда', 'Йосиф', 'Рувим', 'Симеон'], 0, 'Бут. 49:27'),
  q('patriarchs', 'student', 5, 'Хто благословив онуків Єфрема і Манасії?', ['Яків', 'Йосиф', 'Ісaac', 'Авраам'], 0, 'Бут. 48:14'),

  // Відкриття
  q('revelation', 'child', 1, 'Скільки печатей у Одкровенні?', ['7', '12', '4', '3'], 0, 'Одкр. 5:1'),
  q('revelation', 'child', 2, 'Хто написав Одкровення?', ['Іоанн', 'Павло', 'Петро', 'Лука'], 0, 'Одкр. 1:1'),
  q('revelation', 'child', 3, 'Скільки церков у Асії згадано?', ['7', '12', '3', '1'], 0, 'Одкр. 1:11'),
  q('revelation', 'child', 4, 'Хто «переможе» отримає…', ['Життя / вінець', 'Золото', 'Землю', 'Храм'], 0, 'Одкр. 2:10'),
  q('revelation', 'child', 5, 'Що «нове небо і нова земля»?', ['Остання глава', 'Початок', 'Середина', 'Псалом'], 0, 'Одкр. 21'),
  q('revelation', 'youth', 1, 'Скільки труб?', ['7', '12', '4', '3'], 0, 'Одкр. 8'),
  q('revelation', 'youth', 2, 'Хто «звір з моря»?', ['Антихрист (символ)', 'Ной', 'Давид', 'Мойсей'], 0, 'Одкр. 13'),
  q('revelation', 'youth', 3, 'Скільки чаш гніву?', ['7', '12', '10', '3'], 0, 'Одкр. 16'),
  q('revelation', 'youth', 4, 'Хто «Альфа і Омега»?', ['Христос', 'Бог Отець', 'Ангел', 'Іоанн'], 0, 'Одкр. 1:8'),
  q('revelation', 'youth', 5, 'Що «немає більше смерті»?', ['Новий Єрусалим', 'Синай', 'Вавилон', 'Єгипет'], 0, 'Одкр. 21:4'),
  q('revelation', 'student', 1, 'Скільки тисяч запечатлених?', ['144000', '12000', '7000', '12'], 0, 'Одкр. 7:4'),
  q('revelation', 'student', 2, 'Хто «Вавилон велика»?', ['Символ падіння', 'Рим лише', 'Єрусалим', 'Афіни'], 0, 'Одкр. 17'),
  q('revelation', 'student', 3, 'Скільки плодів дерева життя на місяць?', ['12', '7', '40', '1'], 0, 'Одкр. 22:2'),
  q('revelation', 'student', 4, 'Хто «відкрив печаті»?', ['Агнець (Христос)', 'Іоанн', 'Ангел', 'Мойсей'], 0, 'Одкр. 5:5'),
  q('revelation', 'student', 5, 'Останні слова книги?', ['Так, гряди, Господи Ісусе', 'Амінь', 'Мир', 'Любов'], 0, 'Одкр. 22:20'),
];

export const ALL_QUESTIONS: Question[] = [...QUESTIONS, ...EXTRA_QUESTIONS].map(withEmbeddedTopicTags);

let allQuestionsCache: Question[] | null = null;
let allQuestionsPromise: Promise<Question[]> | null = null;

/** Embedded + усі AI питання (кешується) */
export async function getAllQuestionsAsync(): Promise<Question[]> {
  if (allQuestionsCache) return allQuestionsCache;
  if (!allQuestionsPromise) {
    allQuestionsPromise = (async () => {
      const { loadAllAiQuestions } = await import('./questionDbLoader');
      const ai = await loadAllAiQuestions();
      const byId = new Map<string, Question>();
      for (const q of ALL_QUESTIONS) byId.set(q.id, q);
      for (const q of ai) byId.set(q.id, q);
      allQuestionsCache = applyDiskMutations([...byId.values()]);
      return allQuestionsCache;
    })().finally(() => {
      allQuestionsPromise = null;
    });
  }
  return allQuestionsPromise;
}

export function invalidateAllQuestionsCache(): void {
  allQuestionsCache = null;
  allQuestionsPromise = null;
}

/** Restore a saved run — preserves order, no shuffle */
export async function getQuestionsByIdsOrdered(ids: string[]): Promise<Question[]> {
  if (ids.length === 0) return [];
  const all = await getAllQuestionsAsync();
  const byId = new Map(all.map((q) => [q.id, q]));
  const ordered: Question[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    const q = byId.get(id);
    if (!q) continue;
    seen.add(id);
    ordered.push(q);
  }
  return ordered;
}

/**
 * Отримати кількість питань для теми за складністю
 */
export function getQuestionCountByDifficulty(themeId: string, difficulty: Difficulty): number {
  return ALL_QUESTIONS.filter(
    (q) => q.themeId === themeId && q.difficulty === difficulty,
  ).length;
}

/**
 * Отримати загальну кількість питань для теми
 */
export function getQuestionCountByTheme(themeId: string): number {
  return ALL_QUESTIONS.filter((q) => q.themeId === themeId).length;
}

/**
 * Отримати розподіл питань по складності для теми
 */
export function getQuestionDistribution(themeId: string): Record<Difficulty, number> {
  const difficulties: Difficulty[] = ['baby', 'child', 'youth', 'student', 'preacher', 'teacher', 'theologian'];
  const dist: Record<Difficulty, number> = {} as Record<Difficulty, number>;
  for (const diff of difficulties) {
    dist[diff] = getQuestionCountByDifficulty(themeId, diff);
  }
  return dist;
}

/** One entry per id (first wins — embedded rows precede AI in merged pools). */
export function dedupePoolByQuestionId(pool: Question[]): Question[] {
  const byId = new Map<string, Question>();
  for (const q of pool) {
    if (q?.id && !byId.has(q.id)) byId.set(q.id, q);
  }
  return [...byId.values()];
}

export function normalizeQuestionText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Drop questions with identical wording (different ids) so stages do not repeat the same prompt. */
export function dedupePoolByQuestionText(pool: Question[]): Question[] {
  const byText = new Map<string, Question>();
  for (const q of pool) {
    if (!q?.text) continue;
    const key = normalizeQuestionText(q.text);
    if (!byText.has(key)) byText.set(key, q);
  }
  return [...byText.values()];
}

export function dedupePracticePool(pool: Question[]): Question[] {
  return dedupePoolByQuestionText(dedupePoolByQuestionId(pool));
}

export type PracticePickOptions = {
  practiceTrack?: PracticeTrackProgress;
  excludeIds?: string[];
  /** Per-quiz nonce so a fresh run shuffles differently before the stage is saved */
  runNonce?: string;
};

/** Stable shuffle seed from practice attempts — changes when any stage is replayed. */
export function buildPracticeRotationKey(track?: PracticeTrackProgress): string {
  if (!track?.stageResults?.length) return 'initial';
  return [...track.stageResults]
    .sort((a, b) => a.stageIndex - b.stageIndex)
    .map((r) => `${r.stageIndex}:${r.attempts ?? 1}`)
    .join('|');
}

function hashSeed(parts: string[]): number {
  let h = 2166136261;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      h ^= part.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

function seededShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array];
  let state = seed || 1;
  for (let i = result.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function applyExcludeIds(pool: Question[], excludeIds: string[] | undefined, minKeep: number): Question[] {
  if (!excludeIds?.length) return pool;
  const excluded = new Set(excludeIds);
  const filtered = pool.filter((q) => !excluded.has(q.id));
  return filtered.length >= minKeep ? filtered : pool;
}

function pickQuestionsFromPool(
  pool: Question[],
  count = QUESTIONS_PER_LEVEL,
  options?: PracticePickOptions,
): Question[] {
  const unique = applyExcludeIds(
    dedupePracticePool(pool),
    options?.excludeIds,
    count,
  );
  const shuffled = options?.practiceTrack || options?.runNonce
    ? seededShuffle(
        unique,
        hashSeed([
          'practice-pool',
          buildPracticeRotationKey(options?.practiceTrack),
          options?.runNonce ?? '',
        ]),
      )
    : shuffle(unique);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function orderQuestionsStable(pool: Question[]): Question[] {
  return [...pool].sort((a, b) => a.id.localeCompare(b.id));
}

function pickQuestionsForStage(
  pool: Question[],
  stageIndex: number,
  count = PRACTICE_QUESTIONS_PER_STAGE,
  options?: PracticePickOptions,
): Question[] {
  const unique = applyExcludeIds(
    dedupePracticePool(pool),
    options?.excludeIds,
    count,
  );
  const rotationKey = buildPracticeRotationKey(options?.practiceTrack);
  const shuffled = seededShuffle(
    orderQuestionsStable(unique),
    hashSeed(['practice-stage', rotationKey, options?.runNonce ?? '']),
  );
  const start = stageIndex * count;
  const slice = shuffled.slice(start, start + count);
  if (slice.length >= count || shuffled.length === 0) {
    return slice;
  }
  const picked = new Set(slice.map((q) => q.id));
  for (const q of shuffled) {
    if (slice.length >= count) break;
    if (!picked.has(q.id)) {
      slice.push(q);
      picked.add(q.id);
    }
  }
  return slice;
}

export function getStageQuestionCount(poolSize: number, stageIndex: number, count = PRACTICE_QUESTIONS_PER_STAGE): number {
  const start = stageIndex * count;
  if (start >= poolSize) return 0;
  return Math.min(count, poolSize - start);
}

async function loadAiQuestionsForThemes(themeIds: Iterable<string>): Promise<Question[]> {
  const { loadAiQuestionsForTheme } = await import('./questionDbLoader');
  const merged: Question[] = [];
  for (const themeId of themeIds) {
    try {
      merged.push(...(await loadAiQuestionsForTheme(themeId)));
    } catch {
      /* theme may have no AI file */
    }
  }
  return merged;
}

/** Embedded + AI pool for a theme and difficulty (deduped by id and text). */
export async function buildThemeDifficultyPool(
  themeId: string,
  difficulty: Difficulty,
): Promise<Question[]> {
  const embedded = ALL_QUESTIONS.filter(
    (q) => q.themeId === themeId && q.difficulty === difficulty,
  );
  const ai = (await loadAiQuestionsForThemes([themeId])).filter((q) => q.difficulty === difficulty);
  return dedupePracticePool([...embedded, ...ai]);
}

/** Embedded + AI pool for aggregate category nodes (all themes, one difficulty). */
export async function buildCategoryDifficultyPool(
  themeIds: string[],
  difficulty: Difficulty,
): Promise<Question[]> {
  const embedded = ALL_QUESTIONS.filter(
    (q) => themeIds.includes(q.themeId) && q.difficulty === difficulty,
  );
  const ai = (await loadAiQuestionsForThemes(themeIds)).filter((q) => q.difficulty === difficulty);
  return dedupePracticePool([...embedded, ...ai]);
}

export async function getQuestionsForStageAsync(
  themeId: string,
  difficulty: Difficulty,
  stageIndex: number,
  count = PRACTICE_QUESTIONS_PER_STAGE,
  pickOptions?: PracticePickOptions,
): Promise<Question[]> {
  const pool = await buildThemeDifficultyPool(themeId, difficulty);
  return pickQuestionsForStage(pool, stageIndex, count, pickOptions);
}

export async function getQuestionsForCategoryStageAsync(
  themeIds: string[],
  difficulty: Difficulty,
  stageIndex: number,
  count = PRACTICE_QUESTIONS_PER_STAGE,
  pickOptions?: PracticePickOptions,
): Promise<Question[]> {
  const pool = await buildCategoryDifficultyPool(themeIds, difficulty);
  return pickQuestionsForStage(pool, stageIndex, count, pickOptions);
}

function collectRelevantThemeIds(
  nodeId: string,
  topicHierarchy: TopicNode,
  includeParentNodes: boolean,
  includeChildNodes: boolean,
): Set<string> {
  const relevantThemeIds = new Set<string>();
  const targetNode = findNodeById(topicHierarchy, nodeId);

  if (targetNode) {
    if (targetNode.themeId) relevantThemeIds.add(targetNode.themeId);
    if (includeParentNodes) {
      findParentPath(topicHierarchy, nodeId).forEach((node) => {
        if (node.themeId) relevantThemeIds.add(node.themeId);
      });
    }
    if (includeChildNodes) {
      findAllChildNodes(targetNode).forEach((node) => {
        if (node.themeId) relevantThemeIds.add(node.themeId);
      });
    }
  }

  if (relevantThemeIds.size === 0) {
    relevantThemeIds.add(nodeId);
  }
  return relevantThemeIds;
}

/** Embedded + AI pool for a topic node (deduped by id and text). */
export async function buildNodePracticePool(
  nodeId: string,
  topicHierarchy: TopicNode,
  difficulty?: Difficulty,
  includeParentNodes = false,
  includeChildNodes = false,
): Promise<Question[]> {
  const embedded = filterQuestionsByHierarchy(
    ALL_QUESTIONS,
    nodeId,
    topicHierarchy,
    includeParentNodes,
    includeChildNodes,
  );
  const themeIds = collectRelevantThemeIds(
    nodeId,
    topicHierarchy,
    includeParentNodes,
    includeChildNodes,
  );
  const aiQuestions = await loadAiQuestionsForThemes(themeIds);
  let pool = filterQuestionsByHierarchy(
    [...embedded, ...aiQuestions],
    nodeId,
    topicHierarchy,
    includeParentNodes,
    includeChildNodes,
  );
  if (difficulty) {
    pool = pool.filter((q) => q.difficulty === difficulty);
  }
  return dedupePracticePool(pool);
}

export async function getQuestionsForNodeStageAsync(
  nodeId: string,
  topicHierarchy: TopicNode,
  difficulty: Difficulty,
  stageIndex: number,
  count = PRACTICE_QUESTIONS_PER_STAGE,
  includeParentNodes = false,
  includeChildNodes = false,
  pickOptions?: PracticePickOptions,
): Promise<Question[]> {
  const pool = await buildNodePracticePool(
    nodeId,
    topicHierarchy,
    difficulty,
    includeParentNodes,
    includeChildNodes,
  );
  return pickQuestionsForStage(pool, stageIndex, count, pickOptions);
}

/** Синхронно — лише вбудована база (TS-файли) */
export function getQuestionsForLevel(
  themeId: string,
  difficulty: Difficulty,
  count = QUESTIONS_PER_LEVEL,
): Question[] {
  const pool = ALL_QUESTIONS.filter(
    (question) => question.themeId === themeId && question.difficulty === difficulty,
  );
  return pickQuestionsFromPool(dedupePracticePool(pool), count);
}

export function getMixedQuestionsByDifficulty(
  difficulty: Difficulty,
  count: number,
  excludeIds: string[] = [],
): Question[] {
  const pool = ALL_QUESTIONS.filter((question) => question.difficulty === difficulty);
  return pickQuestionsFromPool(pool, count, { excludeIds });
}

/** Вбудована база + AI JSON з data/question-db */
export async function getQuestionsForLevelAsync(
  themeId: string,
  difficulty: Difficulty,
  count = QUESTIONS_PER_LEVEL,
  pickOptions?: PracticePickOptions,
): Promise<Question[]> {
  const pool = await buildThemeDifficultyPool(themeId, difficulty);
  return pickQuestionsFromPool(pool, count, pickOptions);
}

/**
 * Отримати питання для категорії (агрегація з усіх тем категорії)
 */
export async function getQuestionsForCategoryAsync(
  _categoryId: string,
  themeIds: string[],
  difficulty: Difficulty,
  count = QUESTIONS_PER_LEVEL,
  pickOptions?: PracticePickOptions,
): Promise<Question[]> {
  const pool = await buildCategoryDifficultyPool(themeIds, difficulty);
  return pickQuestionsFromPool(pool, count, pickOptions);
}

/** Кількість питань з урахуванням AI (для UI) */
export async function getQuestionCountByDifficultyAsync(
  themeId: string,
  difficulty: Difficulty,
): Promise<number> {
  return (await buildThemeDifficultyPool(themeId, difficulty)).length;
}

/**
 * Отримати кількість питань для категорії (агрегація з усіх тем категорії)
 */
export async function getQuestionCountByCategoryAsync(
  themeIds: string[],
  difficulty: Difficulty,
): Promise<number> {
  return (await buildCategoryDifficultyPool(themeIds, difficulty)).length;
}

/**
 * Фільтрація питань за ієрархією тем (TopicNode)
 */
function collectNodeIdsForFilter(
  node: TopicNode,
  ids: Set<string>,
  includeChildren: boolean,
): void {
  ids.add(node.id);
  if (includeChildren) {
    for (const child of node.children ?? []) {
      collectNodeIdsForFilter(child, ids, true);
    }
  }
}

export function filterQuestionsByHierarchy(
  questions: Question[],
  targetNodeId: string,
  topicHierarchy: TopicNode,
  includeParentNodes = false,
  includeChildNodes = false,
): Question[] {
  const targetNode = findNodeById(topicHierarchy, targetNodeId);
  if (!targetNode) {
    return [];
  }

  const relevantNodeIds = new Set<string>();
  collectNodeIdsForFilter(targetNode, relevantNodeIds, includeChildNodes);

  if (includeParentNodes) {
    const parentPath = findParentPath(topicHierarchy, targetNodeId);
    for (const node of parentPath) {
      relevantNodeIds.add(node.id);
    }
  }

  const rootThemeId = targetNode.themeId ?? targetNodeId;
  const themeUsesNodeTags = questions.some(
    (q) => q.themeId === rootThemeId && q.topicNodeId != null,
  );
  if (themeUsesNodeTags) {
    return questions.filter(
      (q) => q.topicNodeId != null && relevantNodeIds.has(q.topicNodeId),
    );
  }

  const relevantThemeIds = new Set<string>();
  if (targetNode.themeId) relevantThemeIds.add(targetNode.themeId);
  if (includeParentNodes) {
    findParentPath(topicHierarchy, targetNodeId).forEach((node) => {
      if (node.themeId) relevantThemeIds.add(node.themeId);
    });
  }
  if (includeChildNodes) {
    findAllChildNodes(targetNode).forEach((node) => {
      if (node.themeId) relevantThemeIds.add(node.themeId);
    });
  }
  if (relevantThemeIds.size === 0) {
    relevantThemeIds.add(targetNodeId);
  }

  return questions.filter((q) => relevantThemeIds.has(q.themeId));
}

/**
 * Отримання питань для конкретного вузла ієрархії
 */
export async function getQuestionsForNodeAsync(
  nodeId: string,
  topicHierarchy: TopicNode,
  difficulty?: Difficulty,
  count = QUESTIONS_PER_LEVEL,
  includeParentNodes = false,
  includeChildNodes = false,
  pickOptions?: PracticePickOptions,
): Promise<Question[]> {
  const pool = await buildNodePracticePool(
    nodeId,
    topicHierarchy,
    difficulty,
    includeParentNodes,
    includeChildNodes,
  );
  return pickQuestionsFromPool(pool, count, pickOptions);
}

/**
 * Отримання кількості питань для вузла ієрархії
 */
export async function getQuestionCountForNodeAsync(
  nodeId: string,
  topicHierarchy: TopicNode,
  difficulty?: Difficulty,
): Promise<number> {
  return (await buildNodePracticePool(nodeId, topicHierarchy, difficulty, false, false)).length;
}

// Допоміжні функції для роботи з ієрархією

function findNodeById(node: TopicNode, targetId: string): TopicNode | null {
  if (node.id === targetId) {
    return node;
  }
  
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      const found = findNodeById(child, targetId);
      if (found) return found;
    }
  }
  
  return null;
}

function findParentPath(
  node: TopicNode,
  targetId: string,
  path: TopicNode[] = [],
): TopicNode[] {
  if (node.id === targetId) {
    return path;
  }

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      const result = findParentPath(child, targetId, [...path, node]);
      if (result.length > 0 || child.id === targetId) {
        if (child.id === targetId) {
          return [...path, node];
        }
        return result;
      }
    }
  }

  return [];
}

function findAllChildNodes(node: TopicNode): TopicNode[] {
  const children: TopicNode[] = [];
  
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      children.push(child);
      children.push(...findAllChildNodes(child));
    }
  }
  
  return children;
}

export function isLevelCompleted(
  completedLevels: { themeId: string; difficulty: Difficulty }[],
  themeId: string,
  difficulty: Difficulty,
): boolean {
  return completedLevels.some(
    (l) => l.themeId === themeId && l.difficulty === difficulty,
  );
}
