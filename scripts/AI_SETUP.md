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

## 3. Генерація з терміналу

```bash
# 50 питань для географії
npm run generate-ai -- --theme geography --count 50

# одна складність
npm run generate-ai -- --theme paul --count 30 --difficulty youth

# інша модель
npm run generate-ai -- --theme kings --count 20 --model llama3.2

# по всіх 15 темах (довго!)
npm run generate-ai -- --all --count 20

# статистика
npm run questions:stats
```

Файли з'являться тут: `data/question-db/{theme}.json`

**Параметри:**
- `--theme <id>` — тема (див. список нижче)
- `--all` — всі теми
- `--count <N>` — кількість (типово 30, батч по 15)
- `--difficulty <level>` — baby/child/youth/student/preacher/teacher/theologian (або `all`)
- `--model <name>` — модель Ollama (типово `mistral`)

**15 тем:** geography, old-testament, mosaic-law, paul, judges, kings, new-testament, gospels, prophets, psalms, parables, commandments, miracles, patriarchs, revelation

**7 рівнів складності:** baby, child, youth, student, preacher, teacher, theologian

## 4. Telegram-бот (зручно з телефону)

```bash
# Встанови залежності бота
npm run bot:install

# Запусти
npm run bot
```

Команди в боті (тільки для ADMIN_IDS):
- `/stats` — скільки AI-питань у кожній темі
- `/generate geography 50` — згенерувати для теми
- `/generate paul 20 youth` — з рівнем складності
- `/themes` — список id тем
- `/help` — довідка

## 5. AI-сортування підгруп у дереві тем

Скрипт `sort-topics-ai` проходить усі файли `data/topics-db/{theme}.json` і для кожної групи просить AI:
  - відсортувати її підгрупи у теологічно/логічно правильному порядку (хронологія Біблії, канонічний порядок, важливість)
  - (опційно) перенести підгрупу під іншу батьківську групу в тому ж дереві (--reparent)

```bash
# Сортування однієї теми
npm run sort-topics-ai -- --theme paul

# По всіх темах
npm run sort-topics-ai -- --all

# Дозволити переміщення між групами
npm run sort-topics-ai -- --all --reparent

# Переглянути зміни без збереження
npm run sort-topics-ai -- --all --reparent --dry-run

# Зберегти .bak перед перезаписом
npm run sort-topics-ai -- --all --backup
```

**Прапорці:**
- `--theme <id>` — лише одна тема
- `--all` — всі теми
- `--reparent` — дозволити переміщення підгруп між батьківськими вузлами
- `--reorder-only` — лише сортування, без reparent
- `--dry-run` — лише показати зміни
- `--backup` — зберегти `.bak` перед перезаписом
- `--max-depth <N>` — обмежити глибину (типово 5)
- `--model <name>` — модель Ollama

## 6. Аналіз якості та пошук дублікатів

```bash
# Аналіз якості + пошук схожих питань (Jaccard > 75%)
npm run analyze-quality

# Аналіз пулів (study/game)
npm run analyze-pools

# Статистика кількості
npm run questions:stats
```

Звіти зберігаються в корінь проєкту: `question-quality-report.json`, `question-pools-report.json`.

## 7. Система якості (3 рівні)

| Рівень | Де | Що робить |
|--------|----|-----------|
| **При збереженні** | `scripts/lib/question-db.mjs` — `dedupeQuestions()` | Дублікати за ключем `themeId\|difficulty\|normalizedText` |
| **Аналіз якості** | `scripts/analyzeQuestionQuality.ts` | Jaccard-подібність > 75% між усіма парами (TS + AI), оцінка якості (0–100), неоднозначності (0–100) |
| **У грі** | `src/lib/questionQuality.ts` — `QuestionQualityValidator` | Подібність тексту > 85% + перевірка варіантів, скоринг, калібрування складності |

**Карантин:** питання з низькою якістю автоматично потрапляють до `QuestionQuarantineManager` (`src/lib/questionQuarantine.ts`). Статуси: `pending_review`, `approved_fix`, `rejected`. Із гри виключені.

## 8. Як це працює в грі

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
| перевірка | `npm run questions:stats` |
| якість | `npm run analyze-quality` |
| пули | `npm run analyze-pools` |

Після генерації перезапусти `npm run dev` — Vite підхопить нові JSON.

## Усунення проблем

- **Ollama недоступна** — запусти `ollama serve`
- **Порожня відповідь** — зменши `--count` до 10–15 за раз, або зміни модель через `--model`
- **Дублікати** — 3 рівні захисту: при збереженні (`dedupeQuestions`), аналіз (Jaccard > 75%), у грі (Jaccard > 85%)

## Структура проєкту (AI-частина)

```
biblegames_bot/
├── data/question-db/          # JSON-файли AI-питань (по темі)
├── data/topics-db/             # JSON-файли ієрархії тем
├── scripts/
│   ├── generate-questions-ai.mjs    # Генератор питань (Ollama)
│   ├── generate-topics-ai.mjs       # Генератор ієрархії тем
│   ├── sort-topics-ai.mjs           # AI-сортування підгруп у дереві
│   ├── sortQuestionsByCategory.ts   # AI/heuristic-класифікація питань
│   ├── analyze-questions.mjs        # Статистика
│   ├── analyzeQuestionQuality.ts    # Якість + дублікати
│   ├── analyzeQuestionPools.ts      # Пули (study/game)
│   └── lib/
│       ├── ollama.mjs               # HTTP-клієнт Ollama (+ JSON parsing)
│       ├── question-db.mjs          # CRUD + dedupe
│       └── themes-config.mjs        # 15 тем + 7 складностей
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
└── question-quality-report.json     # Звіт аналізу якості
```
