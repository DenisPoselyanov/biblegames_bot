# Локальна AI для генерації питань (Ollama)

Тисячі питань на тему без ручного написання — модель генерує їх українською, скрипт зберігає в `data/question-db/`, гра підхоплює автоматично.

## 1. Встанови Ollama

1. Завантаж: https://ollama.com/download
2. У терміналі:
   ```bash
   ollama serve
   ollama pull mistral
   ```
   (або `llama3.2`, `gemma2` — вкажи в `.env` як `OLLAMA_MODEL`)

## 2. Налаштування `.env`

Створи `.env` з кореня проєкту (копія `.env.example`):

| Змінна | Призначення | Типово |
|--------|-------------|--------|
| `OLLAMA_MODEL` | Модель Ollama | `mistral` |
| `OLLAMA_HOST` | Хост Ollama | `localhost` |
| `OLLAMA_PORT` | Порт Ollama | `11434` |
| `BOT_TOKEN` | Токен @BotFather | – |
| `ADMIN_IDS` | ID адміністраторів | – |

## 3. Генерація питань з терміналу

```bash
# 50 питань для географії (коренева тема)
npm run generate-ai -- --theme geography --count 50

# одна складність
npm run generate-ai -- --theme paul --count 30 --difficulty medium

# інша модель
npm run generate-ai -- --theme kings --count 20 --model llama3.2

# по всіх 15 темах (довго!)
npm run generate-ai -- --all --count 20

# по групі Завіту (9 тем Старого Завіту)
npm run generate-ai -- --group ot-group --count 30

# по конкретній підтемі (напр. "Галілея" з geography)
npm run generate-ai -- --topic geography-sub-1-sub-1 --count 10

# статистика
npm run questions:stats
```

Файли з'являться тут: `data/question-db/{theme}.json`

**Параметри:**
- `--theme <id>` — тема (див. список нижче)
- `--group <groupId>` — група: `ot-group` (Старий Завіт, 9 тем) або `nt-group` (Новий Завіт, 6 тем)
- `--topic <nodeId>` — конкретна підтема (будь-якої глибини, наприклад `geography-sub-1-sub-1`)
- `--all` — всі теми
- `--count <N>` — кількість (типово 30, батч по 15)
- `--difficulty <level>` — baby/child/youth/student/preacher/teacher/theologian (або `all`)
- `--model <name>` — модель Ollama (типово `mistral`)

**15 тем:** geography, old-testament, mosaic-law, paul, judges, kings, new-testament, gospels, prophets, psalms, parables, commandments, miracles, patriarchs, revelation

**2 групи (Завіти):** `ot-group` (Старий Завіт), `nt-group` (Новий Завіт)

**7 рівнів складності:** baby👶, child🧒, youth🧑, student🎓, preacher📖, teacher👨‍🏫, theologian⛪

**Як працює `--topic`:**
1. Скрипт завантажує відповідний файл теми/групи з `data/topics-db/`
2. Будує шлях до вузла (напр. "Географія > Земля Ізраїльська > Галілея")
3. Додає опис вузла в промпт AI
4. AI генерує питання, специфічні для цієї підтеми

**Як працює `--group`:**
1. Скрипт завантажує агрегатний файл групи (напр. `ot-group.json`)
2. Проходить по всіх `themeIds` групи
3. Для кожної теми генерує `count` питань
4. Результати зберігаються в `data/question-db/{theme}.json`

## 4. Генерація ієрархії тем та підтем

Окремий AI-генератор створює деревоподібну структуру: Завіт > Тема > Підтема (до 3 рівнів глибини).

```bash
# Одна тема
npm run generate-topics -- --theme geography

# Всі теми одразу
npm run generate-topics -- --all

# Інша модель
npm run generate-topics -- --theme paul --model llama3.2

# Група (всі теми Завіту в одному файлі)
npm run generate-topics -- --group ot-group
```

Файли з'являються тут: `data/topics-db/{theme}.json`

**Параметри:**
- `--theme <id>` — тема (див. список 15 тем)
- `--group <groupId>` — група: `ot-group` або `nt-group` (генерує один файл з усіма темами групи)
- `--all` — всі теми
- `--model <name>` — модель Ollama (типово `mistral`)

**Як це працює:**
1. Скрипт перевіряє, чи вже існує файл — якщо так, пропускає (ідемпотентність)
2. Будує промпт із назвою теми/групи та контекстом
3. Для `--group`: промпт інструктує AI створити всі теми групи в одному JSON
4. AI повертає JSON-об'єкт з ієрархією
5. Результат валідується та зберігається

**Приклад згенерованої структури (`geography.json`):**
```json
{
  "id": "geography",
  "title": "Географія",
  "themeId": "geography",
  "icon": "🌍",
  "children": [
    {
      "id": "geography-sub-1",
      "title": "Земля Ізраїльська",
      "icon": "🏞️",
      "themeId": "geography",
      "children": [
        {
          "id": "geography-sub-1-sub-1",
          "title": "Галілея",
          "icon": "⛰️",
          "themeId": "geography",
          "children": []
        },
        {
          "id": "geography-sub-1-sub-2",
          "title": "Юдея",
          "icon": "🏜️",
          "themeId": "geography",
          "children": []
        }
      ]
    }
  ]
}
```

**Кожен вузол має:**
| Поле | Опис |
|------|------|
| `id` | Унікальний ідентифікатор (напр. `geography-sub-1-sub-1`) |
| `title` | Назва українською |
| `description` | Короткий опис (1 речення) |
| `icon` | Емодзі для візуального позначення |
| `themeId` | ID кореневої теми (для навігації між файлами) |
| `aggregateThemeIds` | Масив ID тем для агрегатних вузлів (тільки в групах) |
| `children` | Масив дочірніх вузлів (порожній для листків) |

**Структура проєкту (теми):**
```
data/topics-db/
├── ot-group.json        # Старий Завіт (агрегат 9 тем)
├── nt-group.json        # Новий Завіт (агрегат 6 тем)
├── geography.json       # Географія
├── old-testament.json   # Старий Завіт
├── mosaic-law.json      # Закон Мойсея
├── paul.json            # Апостол Павло
├── judges.json          # Судді
├── kings.json           # Царі
├── new-testament.json   # Новий Завіт
├── gospels.json         # Євангелія
├── prophets.json        # Пророки
├── psalms.json          # Псалми
├── parables.json        # Притчі
├── commandments.json    # Десять заповідень
├── miracles.json        # Чудеса Ісуса
├── patriarchs.json      # Патріархи
└── revelation.json      # Відкриття
```

**Як теми використовуються в грі:**
- Вибір теми в інтерфейсі показує ієрархічне дерево замість плоского списку
- Користувач може обрати кореневу тему, підтему або конкретну підпідтему
- Гравці бачать емодзі + назву, що полегшує навігацію
- У майбутньому: фільтрація питань за вибраним вузлом дерева

**Чим відрізняється від генерації питань:**
| | Генерація питань | Генерація тем |
|--|-----------------|---------------|
| Скрипт | `generate-questions-ai.mjs` | `generate-topics-ai.mjs` |
| Команда | `npm run generate-ai` | `npm run generate-topics` |
| Куди зберігає | `data/question-db/` | `data/topics-db/` |
| Формат | Масив об'єктів питань | Один JSON-об'єкт з деревом |
| Параметри | `--theme`, `--group`, `--topic`, `--count`, `--difficulty`, `--model` | `--theme`, `--group`, `--all`, `--model` |
| Ідемпотентність | Додає нові питання до існуючих | Пропускає, якщо файл вже існує |
| Перезапуск | Потрібен для Vite | Не потрібен (дані для інтерфейсу) |

## 5. Telegram-бот (зручно з телефону)

```bash
# Встанови залежності бота
npm run bot:install

# Запусти
npm run bot
```

Команди в боті (тільки для ADMIN_IDS):
- `/stats` — скільки AI-питань у кожній темі
- `/generate geography 50` — згенерувати для теми
- `/generate paul 20 medium` — з рівнем складності
- `/themes` — список id тем
- `/help` — довідка

## 6. Аналіз якості та пошук дублікатів

```bash
# Аналіз якості + пошук схожих питань (Jaccard > 75%)
npm run analyze-quality

# Аналіз пулів (study/game)
npm run analyze-pools

# Статистика кількості
npm run questions:stats

# Аналіз якості ієрархії тем (breadth, uniqueness, описи)
npm run analyze-topics
```

Звіти зберігаються:
- `question-quality-report.json` — якість питань
- `question-pools-report.json` — пули
- `data/topics-quality-report.json` — якість ієрархії тем

## 7. Система якості (3 рівні)

| Рівень | Де | Що робить |
|--------|----|-----------|
| **При збереженні** | `scripts/lib/question-db.mjs` — `dedupeQuestions()` | Дублікати за ключем `themeId\|difficulty\|normalizedText` |
| **Аналіз якості** | `scripts/analyzeQuestionQuality.ts` | Jaccard-подібність > 75% між усіма парами (TS + AI), оцінка якості (0–100), неоднозначності (0–100) |
| **У грі** | `src/lib/questionQuality.ts` — `QuestionQualityValidator` | Подібність тексту > 85% + перевірка варіантів, скоринг, калібрування складності |

**Карантин:** питання з низькою якістю автоматично потрапляють до `QuestionQuarantineManager` (`src/lib/questionQuarantine.ts`). Статуси: `pending_review`, `approved_fix`, `rejected`. Із гри виключені.

## 8. Аналіз якості ієрархії тем

Скрипт `scripts/analyze-topics.mjs` оцінює якість кожної підтеми:

```bash
npm run analyze-topics
```

**Метрики:**
- **Breadth (ширина, 0-100):** наскільки тема "широка" — довжина опису, кількість дітей/нащадків, глибина, ключові слова
- **Uniqueness (унікальність):** виявлення дублікатів назв між файлами
- **Description quality:** чи є опис, його довжина та змістовність
- **ID validity:** перевірка дублікатів ID у межах файлу та між файлами
- **Logical consistency:** чи всі `themeId` посилаються на існуючі теми

**Кольорове маркування:**
- 🔴 < 30 — вузька тема (потребує розширення)
- 🟡 30-60 — середня тема
- 🟢 ≥ 60 — широка тема

## 9. Ollama Launcher (графічний інтерфейс)

`scripts/ollama_launcher.py` — десктопний GUI для керування AI-генерацією:

```bash
python scripts/ollama_launcher.py
```

**4 картки:**
1. **🎯 Генерація питань** — запуск `npm run generate-ai` з параметрами (тема, група, кількість, складність)
2. **🏷️ Генерація тем** — запуск `npm run generate-topics` (тема або група)
3. **📊 Аналіз та звіти** — запуск `npm run analyze-quality`, `npm run analyze-pools`, `npm run questions:stats`
4. **🔍 Якість тем** — аналіз + редактор:
   - Вбудований аналіз якості (breadth score, фільтри)
   - Список усіх підтем з кольоровим маркуванням
   - Фільтр за файлом та діапазоном балів
   - Редагування: клік по темі → зміна іконки, назви, опису
   - Збереження змін назад у JSON-файл

## 10. Як це працює в грі

- Вбудовані питання: `src/data/questions*.ts` (~600+ питань)
- AI-питання: JSON у `data/question-db/` (завантажуються асинхронно через `src/data/questionDbLoader.ts`)
- При старті квізу гра змішує обидва джерела і вибирає 7 випадкових
- Пул **study** (для навчання) — питання з reference, quality ≥ 60
- Пул **game** (для ігор) — всі питання, крім карантинних
- Режими: millionaire, survival, kahoot, exploration — кожен вибирає з відповідного пулу

## Поради для тисяч питань

| Ціль | Команда |
|------|---------|
| ~200 на тему | `--count 200` кілька разів |
| різні рівні | `--difficulty easy` окремо для кожного |
| по групі | `--group ot-group --count 100` |
| по підтемі | `--topic geography-sub-1 --count 20` |
| перевірка | `npm run questions:stats` |
| якість | `npm run analyze-quality` |
| якість тем | `npm run analyze-topics` |
| пули | `npm run analyze-pools` |

Після генерації перезапусти `npm run dev` — Vite підхопить нові JSON.

## Усунення проблем

- **Ollama недоступна** — запусти `ollama serve`
- **Порожня відповідь** — зменши `--count` до 10–15 за раз, або зміни модель через `--model`
- **Дублікати** — 3 рівні захисту: при збереженні (`dedupeQuestions`), аналіз (Jaccard > 75%), у грі (Jaccard > 85%)

## 11. Структура проєкту (AI-частина)

```
biblegames_bot/
├── data/
│   ├── question-db/           # JSON-файли AI-питань (по темі)
│   ├── topics-db/             # JSON-файли ієрархії тем (17 файлів: 2 групи + 15 тем)
│   └── topics-quality-report.json  # Звіт аналізу якості тем
├── scripts/
│   ├── ollama_launcher.py          # GUI-лаунчер (4 картки)
│   ├── generate-questions-ai.mjs   # Генератор питань (Ollama)
│   ├── generate-topics-ai.mjs      # Генератор ієрархії тем (Ollama)
│   ├── analyze-topics.mjs          # Аналіз якості ієрархії тем (breadth, uniqueness)
│   ├── analyze-questions.mjs       # Статистика питань
│   ├── analyzeQuestionQuality.ts   # Якість + дублікати питань
│   ├── analyzeQuestionPools.ts     # Пули (study/game)
│   └── lib/
│       ├── ollama.mjs              # HTTP-клієнт Ollama
│       ├── question-db.mjs         # CRUD + dedupe (топік-аware)
│       └── themes-config.mjs       # 15 тем + 7 складностей + GROUPS + хелпери
├── bot/index.mjs              # Telegram-бот (admin)
├── src/
│   ├── data/
│   │   ├── questions.ts             # Вбудовані питання
│   │   ├── questions-extra.ts       # Додаткові питання
│   │   └── questionDbLoader.ts      # Lazy loader для JSON
│   └── lib/
│       ├── questionQuality.ts       # Quality + duplicate detection
│       ├── questionQuarantine.ts    # Карантин
│       └── questionPools.ts         # Студійний/ігровий пул
├── question-quality-report.json     # Звіт аналізу якості питань
└── question-pools-report.json       # Звіт аналізу пулів
```

## npm scripts (AI-частина)

| Команда | Скрипт | Опис |
|---------|--------|------|
| `npm run generate-ai` | `generate-questions-ai.mjs` | Генерація питань через Ollama |
| `npm run generate-topics` | `generate-topics-ai.mjs` | Генерація ієрархії тем |
| `npm run analyze-topics` | `analyze-topics.mjs` | Аналіз якості ієрархії тем |
| `npm run analyze-quality` | `analyzeQuestionQuality.ts` | Аналіз якості питань |
| `npm run analyze-pools` | `analyzeQuestionPools.ts` | Аналіз пулів |
| `npm run questions:stats` | `analyze-questions.mjs` | Статистика питань |
| `npm run sort-questions` | `sortQuestionsByCategory.ts` | Сортування питань по категоріях |
