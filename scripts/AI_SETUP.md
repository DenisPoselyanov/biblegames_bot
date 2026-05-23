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
npm run generate-ai -- --theme paul --count 30 --difficulty youth

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

**5 рівнів складності:** beginner, easy, medium, hard, expert

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

## 5. Аналіз якості та пошук дублікатів

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

## 7. Як це працює в грі

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
├── data/question-db/          # JSON-файли AI-питань (по темі)
├── scripts/
│   ├── generate-questions-ai.mjs    # Генератор (Ollama)
│   ├── analyze-questions.mjs        # Статистика
│   ├── analyzeQuestionQuality.ts    # Якість + дублікати
│   ├── analyzeQuestionPools.ts      # Пули (study/game)
│   └── lib/
│       ├── ollama.mjs               # HTTP-клієнт Ollama
│       ├── question-db.mjs          # CRUD + dedupe
│       └── themes-config.mjs        # 15 тем + 5 складностей
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
