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
| `GEMINI_MODEL` | Модель Gemini | `gemini-3.1-flash-lite` |
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

**Модель практики:** кожне питання має `topicNodeId` — id **листової підтеми** з `data/topics-db/`. Без цього тега питання не з’являються на екрані підтеми в грі.

```bash
# Статистика прогалин по підтемах
npm run questions:stats

# Заповнити всі підтеми однієї теми до 100% (рекомендовано)
npm run fill-practice-nodes -- --theme pentateuch --provider gemini --model gemini-3.1-flash-lite

# Одна підтема × одна складність
npm run fill-practice-nodes -- --node pentateuch-sub-1-sub-1 --difficulty baby

# Група Старого Завіту
npm run fill-practice-nodes -- --group old-testament --dry-run

# Точкова генерація (50 питань для однієї підтеми)
npm run generate-ai -- --topic pentateuch-sub-1-sub-1 --count 50 --difficulty baby

# Кілька рівнів складності
npm run generate-ai -- --topic judges-sub-1-sub-1 --count 12 --difficulties baby,child,youth

# Вирівнювання підтем
npm run balance-questions -- --theme geography --scope leaves --practice-ready --dry-run
npm run balance-questions -- --node geography-sub-1-sub-1 --practice-ready

# Видалити питання без topicNodeId (не граються в підтемах)
npm run prune-untagged -- --dry-run
npm run prune-untagged
```

Файли: `data/question-db/{theme}.json` — поле `topicNodeId` обов’язкове для нових AI-питань.

**Цілі на підтему × складність:** baby–youth **50**, student–preacher **40**, teacher–theologian **30** (10 питань/етап).

**Параметри generate-ai:**
- `--topic <nodeId>` — **обов’язково** для точкової генерації (листова підтема)
- `--theme` / `--all` / `--group` — лише з `--allow-theme-only` (legacy, не для практики в UI)
- `--count <N>` — кількість (батч по 15)
- `--stages <N>` — еквівалент `--count (N×10)` для одного рівня
- `--difficulty` / `--difficulties` — рівні складності
- `--provider` / `--model` — AI-провайдер

**Параметри fill-practice-nodes:**
- `--theme`, `--group`, `--covenant`, `--node`, `--difficulty` — фільтри (`--covenant` = лише гілки з `extensions/`)
- `--dry-run` — план без генерації
- `--max-questions`, `--max-jobs` — ліміти сесії

> ⚠️ `npm run fill-practice` (рівень теми без `topicNodeId`) **застаріло** — використовуй `fill-practice-nodes`.
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
npm run analyze-quality      # якість + дублікати (--node / --topic для однієї підтеми)
npm run analyze-explanations # пояснення (--node, --theme)
npm run analyze-pools        # пули study/game + прогалини підтем
npm run analyze-topics       # ієрархія тем → data/topics-quality-report.json
npm run sort-questions -- --ai --limit 50   # topicNodeId для старих питань
npm run fix-questions-ai -- --node <id> --limit 10
npm run fix-explanations-ai -- --node <id> --coverage missing
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
| `npm run generate-ai` | Генерація для однієї підтеми (`--topic`) |
| `npm run fill-practice-nodes` | Заповнення всіх підтем до 100% |
| `npm run prune-untagged` | Видалення питань без topicNodeId |
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
- **Неточний баланс підтем** — `npm run sort-questions -- --ai`, потім `fill-practice-nodes` або `balance-questions --practice-ready`
- **Підтема показує 0 питань** — перевір `topicNodeId`; запусти `fill-practice-nodes -- --node <id>`
