# Локальна AI для генерації питань

Тисячі питань на тему без ручного написання — модель генерує їх українською, скрипт зберігає в `data/question-db/`, гра підхоплює автоматично.

Підтримуються три провайдери (вибір у GUI **Налаштування** або `--provider` у CLI):

| Провайдер | Коли використовувати |
|-----------|----------------------|
| **Ollama** | Локально, без API-ключів (`ollama serve`) |
| **Gemini** | Google AI Studio, хмарна модель (`GEMINI_API_KEY`) |
| **OmniRoute** | Локальний шлюз на `http://localhost:20128/v1`, маршрутизація на багато моделей |

## 1. Встанови Ollama (якщо обрано Ollama)

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
| `AI_PROVIDER` | `ollama` / `gemini` / `omniroute` | `ollama` |
| `AI_MODEL` | Активна модель (усі провайдери) | `mistral` |
| `OLLAMA_MODEL` | Модель Ollama (сумісність) | `mistral` |
| `OLLAMA_HOST` | Хост Ollama | `localhost` |
| `OLLAMA_PORT` | Порт Ollama | `11434` |
| `GEMINI_API_KEY` | Ключ Google AI Studio | – |
| `GEMINI_MODEL` | Модель Gemini | `gemini-2.0-flash` |
| `OMNIROUTE_BASE_URL` | База API OmniRoute | `http://localhost:20128/v1` |
| `OMNIROUTE_API_KEY` | Ключ з дашборду OmniRoute | – |
| `OMNIROUTE_MODEL` | ID моделі в OmniRoute | `google/gemini-2.0-flash` |
| `BOT_TOKEN` | Токен @BotFather | – |
| `ADMIN_IDS` | ID адміністраторів | – |

## 3. AI Launcher V3 (GUI)

Залежності Python (один раз):

```bash
pip install -r scripts/requirements-launcher.txt
```

Запуск (без «завислого» CMD):

```bash
npm run ai-launcher
```

Або подвійний клік у корені проєкту:

- **Скрипти AI.vbs** — рекомендовано (без чорного вікна)
- **Скрипти AI.bat** — те саме, CMD закривається одразу

**Вкладки:**
- **Питання** — stats, generate-ai, balance-questions, sort-questions, analyze-quality, analyze-pools, scripture:audit
- **Теми** — generate-topics, sort-topics-ai, merge-topics-db
- **Конвеєр** — покрокова ієрархія L1→L2 (з підтвердженням) → L3 → питання
- **Якість тем** — analyze-topics, фільтри, клік → AI-дії з темою
- **Налаштування** — провайдер (Ollama / Gemini / OmniRoute), модель, ключі, шляхи

## 4. Генерація питань з терміналу

```bash
# 50 питань для географії (коренева тема)
npm run generate-ai -- --theme geography --count 50

# одна складність
npm run generate-ai -- --theme paul --count 30 --difficulty youth

# по групі Завіту (9 тем Старого Завіту)
npm run generate-ai -- --group old-testament --count 30

# по конкретній підтемі
npm run generate-ai -- --topic geography-sub-1-sub-1 --count 10

# кілька рівнів складності (count ділиться між обраними)
npm run generate-ai -- --topic judges-sub-1-sub-1 --count 12 --difficulties baby,child,youth

# вирівнювання підтем (догенерувати до max)
npm run balance-questions -- --theme geography --dry-run
npm run balance-questions -- --node geography-sub-1

# статистика
npm run questions:stats
```

Файли з'являться тут: `data/question-db/{theme}.json`

**Параметри generate-ai:**
- `--theme <id>` — тема (див. список нижче)
- `--group <groupId>` — `old-testament` (9 тем ВЗ) або `new-testament` (6 тем НЗ)
- `--topic <nodeId>` — конкретна підтема
- `--all` — всі теми
- `--count <N>` — кількість (батч по 15)
- `--difficulty <level>` — baby/child/youth/student/preacher/teacher/theologian (або `all`)
- `--difficulties baby,child,youth` — підмножина рівнів (пріоритет над `--difficulty`)
- `--provider ollama|gemini|omniroute` — AI-провайдер (або `AI_PROVIDER` у `.env`)
- `--model <name>` — модель

## 4b. Конвеєр ієрархії тем (GUI + CLI)

**GUI — вкладка «Конвеєр»:**

1. **Завіт** — Старий або Новий Завіт (фіксується для гілки).
2. **Режим «Нова гілка в завіті»** (за замовчуванням): ідея назви → «Згенерувати гілку» або «Запустити конвеєр» → review з **редагуванням назви** → Прийняти / Відхилити / Перегенерувати.
3. **Глибина** — L1 завжди; чекбокси **Підтеми L2** і **Підпідтеми L3** (можна вимкнути).
4. L1/L2 — підтвердження; L3 і питання — автоматично.
5. Збереження гілок: `data/topics-db/extensions/{covenant}.json` → **Merge topics-db**.

**Режим «Існуючий файл теми»** — як раніше (`judges.json` тощо).

**CLI — гілка завіту:**
```bash
npm run topic-conveyor -- --action preview-branch --covenant old-testament --title "Жертовник" --json
npm run topic-conveyor -- --action apply-branch --covenant old-testament --input data/topic-conveyor-branch.json --json
```

**CLI — підтеми в extensions:**
```bash
npm run topic-conveyor -- --target extensions --action preview --covenant old-testament --parent ot-custom-foo --count 3 --json
```

**15 тем:** geography, old-testament, mosaic-law, paul, judges, kings, new-testament, gospels, prophets, psalms, parables, commandments, miracles, patriarchs, revelation

**7 рівнів складності:** baby, child, youth, student, preacher, teacher, theologian

## 5. Telegram-бот (зручно з телефону)

```bash
npm run bot:install
npm run bot
```

Команди в боті (тільки для ADMIN_IDS): `/stats`, `/generate geography 50`, `/themes`, `/help`

## 6. Аналіз якості

```bash
npm run analyze-quality      # якість + дублікати питань
npm run analyze-pools        # пули study/game
npm run analyze-topics       # ієрархія тем → data/topics-quality-report.json
npm run sort-questions -- --ai --limit 50   # класифікація по підтемах
npm run sort-topics-ai -- --all --reparent # AI-сортування підгруп тем
npm run scripture:audit      # перевірка reference (потрібен server :3001)
npm run ai-topic-edit -- --action improve-desc --file gospels --node gospels-sub-1
```

Звіти:
- `question-quality-report.json` — якість питань
- `question-pools-report.json` — пули
- `data/topics-quality-report.json` — якість ієрархії тем
- `data/question-balance-report.json` — вирівнювання підтем

## 7. balance-questions

Вирівнює кількість питань між підтемами одного рівня (ціль = max або `--target N`):

| Прапор | Опис |
|--------|------|
| `--theme <id>` / `--node <id>` | Якір ієрархії |
| `--scope siblings` | Прямі діти (default) |
| `--scope leaves` | Усі листові підтеми |
| `--target <N>` | 0 = auto max |
| `--dry-run` | Таблиця gap без Ollama |

Підрахунок: `topicNodeId` → `question-categories.json` → heuristic. Якщо багато питань без привʼязки — спочатку `sort-questions -- --ai`.

## 8. Система якості (3 рівні)

| Рівень | Де | Що робить |
|--------|----|-----------|
| **При збереженні** | `question-db.mjs` | dedupe за ключем |
| **Аналіз** | `analyzeQuestionQuality.ts` | Jaccard > 75% |
| **У грі** | `questionQuality.ts` | Jaccard > 85% + карантин |

## npm scripts (AI)

| Команда | Опис |
|---------|------|
| `npm run ai-launcher` | GUI (Python/Tk) |
| `npm run generate-ai` | Генерація питань |
| `npm run balance-questions` | Вирівнювання підтем |
| `npm run generate-topics` | Ієрархія тем |
| `npm run sort-topics-ai` | AI-сортування тем |
| `npm run ai-topic-edit` | AI-редактор вузла теми |
| `npm run analyze-topics` | Звіт якості тем |
| `npm run analyze-quality` | Якість питань |
| `npm run sort-questions` | Класифікація питань |
| `npm run scripture:audit` | Аудит біблійних посилань |

## Усунення проблем

- **Ollama недоступна** — `ollama serve`
- **Gemini** — перевір `GEMINI_API_KEY` у `.env`; ключ: [Google AI Studio](https://aistudio.google.com/apikey)
- **OmniRoute** — запусти `npx omniroute`, відкрий http://localhost:20128, створи API key у Endpoints
- **Порожня відповідь** — зменши `--count`, зміни `--model` або провайдера
- **Неточний баланс підтем** — `npm run sort-questions -- --ai`, потім повтори balance
