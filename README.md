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

### Підключення до бота

1. Створіть бота через [@BotFather](https://t.me/BotFather).
2. `/newapp` → вкажіть URL зібраного застосунку.
3. У BotFather встановіть Menu Button або Web App URL.

## Механіка гри

| Складність   | Очки за рівень (100% відповідей) |
|--------------|----------------------------------|
| Початковий   | 5                                |
| Легкий       | 15                               |
| Середній     | 30                               |
| Складний     | 60                               |
| Експерт      | 100                              |

- 15 тематик (Географія, Старий Завіт, Павло, Судді, Царі…)
- 7 запитань на рівень (випадковий порядок)
- Очки = базові очки × відсоток правильних відповідей

## Режими гри

| Режим | Опис |
|-------|------|
| **Соло** | Теми → складність → 7 питань, особистий прогрес |
| **Kahoot** | Кімната за кодом, нікнейми, відповіді на час |

### Kahoot (мультиплеєр)

Потрібен сервер у другому терміналі:

```bash
npm run server:install   # один раз
npm run server           # http://localhost:3001
npm run dev              # гра
```

У грі: **Гра → Кімната (Kahoot)** → створити або приєднатися за кодом.

## Локальна AI — тисячі питань (Ollama)

Детальна інструкція: [`scripts/AI_SETUP.md`](scripts/AI_SETUP.md)

```bash
npm run generate-ai -- --theme geography --count 50
npm run questions:stats
npm run bot:install && npm run bot   # адмін-бот у Telegram
```

Питання зберігаються в `data/question-db/*.json` і автоматично додаються до гри.

## Глобальна статистика

Зараз дані зберігаються в `localStorage` (профіль і рейтинг на пристрої). Для справжнього мультиплеєрного рейтингу підключіть backend (Supabase, Firebase, власний API) у `src/lib/storage.ts`.

## Структура

```
src/data/              # теми та вбудовані питання
data/question-db/      # AI-питання (JSON)
scripts/               # генератор Ollama
bot/                   # Telegram адмін-бот
```
