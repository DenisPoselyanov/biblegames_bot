# Біблійна гра — Telegram Mini App

Вікторина для вивчення Біблії: тематики, рівні складності, очки в профілі та глобальна статистика за темами.

## Стек

- React 19 + TypeScript
- Vite
- [@twa-dev/sdk](https://github.com/twa-dev/sdk) — Telegram Web App API
- React Router

## Запуск локально

```bash
cd bible-game
npm install
npm run dev
```

Відкрийте `http://localhost:5173`. Без Telegram працює режим гостя.

## Збірка для Telegram

```bash
npm run build
```

Завантажте папку `dist/` на HTTPS-хостинг (GitHub Pages, Vercel, Netlify тощо).

### GitHub Pages (цей репозиторій)

- **Правильний URL для BotFather:** `https://denisposelyanov.github.io/biblegames_bot/` (обовʼязково з `/biblegames_bot/`).
- Корінь `https://denisposelyanov.github.io/` дає 404 — це не Mini App.
- Після `git push` у `main` workflow [deploy-pages.yml](.github/workflows/deploy-pages.yml) збирає `dist/` і публікує на гілку `gh-pages` (1–3 хв).
- Локальна збірка для Pages: `npm run build:pages` (base path + `404.html` для перезавантаження в Telegram).
- **Перезавантаження** на вкладці «Профіль» / «Гра» без `404.html` давало GitHub 404 — після деплою з `copy-github-pages-404.mjs` має відкриватися знову.

### Підключення до бота

1. Створіть бота через [@BotFather](https://t.me/BotFather).
2. `/newapp` → вкажіть URL зібраного застосунку.
3. У BotFather встановіть Menu Button або Web App URL.

## Механіка гри

| Складність   | Emoji | Очки за рівень (100% відповідей) |
|--------------|-------|----------------------------------|
| Немовля       | 👶    | 5                                |
| Дитина        | 🧒    | 15                               |
| Юнак          | 🧑    | 30                               |
| Учень         | 🎓    | 50                               |
| Проповідник   | 📖    | 80                               |
| Учитель       | 👨‍🏫  | 120                              |
| Богослов      | ⛪    | 200                              |

- 15 тематик (Географія, Старий Завіт, Павло, Судді, Царі…)
- 7 рівнів складності (👶 Немовля → ⛪ Богослов)
- **Практика:** етапи по 10 питань (70% для проходження), глобальний ранг і мудрість
- Очки = базові очки × відсоток правильних відповідей

## Practice Mode 2.0 — Етапи, ранг, ієрархія тем

### Режими навчання
| Режим | Опис |
|-------|------|
| **Practice** | Теми → складність → етапи (3–5 на рівень, 10 питань кожен) |
| **Review Mistakes** | Повторення питань, де були помилки |

### Прогрес практики
- **Етапи:** 10 питань, мінімум 7 правильних для проходження
- **Ранг гравця:** tier + плашка (VII→I), очки мудрості, розблокування складностей
- **Треки:** `practiceTracks` по темі / вузлу / складності
- **Mastery:** окремо відстежується по вузлах ієрархії (`studyMastery`)

### Ієрархія тем
- Розділ → підтема → мікротема
- Степпер етапів на сторінці теми
- Рекомендації: продовжити етап, слабкі місця, логічний шлях, повторення

## Режими гри

| Режим | Опис |
|-------|------|
| **Practice** | Теми → етапи × 10 питань, ранг і мудрість |
| **Review Mistakes** | Повторення питань, де були помилки |
| **Kahoot** | Кімната за кодом, нікнейми, відповіді на час |

### Kahoot (мультиплеєр)

Потрібен сервер у другому терміналі:

```bash
npm run server:install   # один раз
npm run server           # http://localhost:3001
npm run dev              # гра
```

У грі: **Гра → Кімната (Kahoot)** → створити або приєднатися за кодом.

### Backend storage mode

Server підтримує 2 режими зберігання:

- `STORAGE_PROVIDER=json` — локальний `server/.data/db.json`
- `STORAGE_PROVIDER=sql` — PostgreSQL/Supabase через `DATABASE_URL`

Швидка перевірка storage:

```bash
curl http://localhost:3001/health/storage
```

Очікувана відповідь:

```json
{ "ok": true, "provider": "json" }
```

## Локальна AI — тисячі питань (Ollama)

Детальна інструкція: [`scripts/AI_SETUP.md`](scripts/AI_SETUP.md)

```bash
npm run generate-ai -- --theme geography --count 50
npm run generate-topics
npm run sort-questions
npm run questions:stats
npm run bot:install && npm run bot   # адмін-бот у Telegram
```

Питання зберігаються в `data/question-db/*.json` і автоматично додаються до гри.

## Нові npm скрипти 🆕

| Команда | Призначення |
|---------|-------------|
| `npm run generate-topics` | Генерація ієрархії тем через Ollama |
| `npm run sort-questions` | Сортування питань по категоріях та ієрархії |

## Глобальна статистика

Зараз дані зберігаються в `localStorage` (профіль і рейтинг на пристрої). Для справжнього мультиплеєрного рейтингу підключіть backend (Supabase, Firebase, власний API) у `src/lib/storage.ts`.

## Структура

```
src/                   # React додаток
├── components/         # UI компоненти
│   ├── TopicMap.tsx        # Інтерактивна карта прогресу 🆕
│   └── ...
├── lib/                 # Бібліотеки та утиліти
│   ├── practiceProgression.ts  # Етапи, ранг, мудрість
│   ├── recommendationEngine.ts # Рекомендації навчання
│   └── ...
├── pages/               # Сторінки
│   ├── PracticeStageStepper.tsx
│   └── ...
src/data/              # теми та вбудовані питання
data/topics-db/       # Ієрархії тем (15 JSON файлів) 🆕
data/question-db/      # AI-питання (JSON)
scripts/               # генератори та інструменти
├── generate-topics-ai.mjs # Генерація ієрархій тем 🆕
└── sortQuestionsByCategory.ts # Сортування питань по категоріях 🆕
bot/                   # Telegram адмін-бот
server/                # Backend сервер
```
