# Supabase (Postgres) через Express BFF

Клієнт **не** використовує `@supabase/supabase-js`. Дані йдуть через `VITE_API_BASE_URL` і Telegram `x-telegram-init-data`.

## 1. Схема

У Supabase Dashboard → SQL Editor виконайте файл:

[`server/db/schema.sql`](../server/db/schema.sql)

## 2. Змінні середовища (сервер)

```env
STORAGE_PROVIDER=sql
DATABASE_URL=postgresql://postgres.[ref]:[password]@...pooler.supabase.com:6543/postgres
PG_SSL=true
```

Для локальної розробки можна лишити `STORAGE_PROVIDER=json`.

## 3. Перевірка

```bash
npm run server:dev
curl http://localhost:3001/health/storage
```

Очікується JSON з `provider: "sql"` після підключення БД.

## 4. Профіль / статистика

- `GET/PUT /profile/:userId`
- `GET/PUT /stats/:userId`

Клієнт: zustand (local cache) + TanStack Query (sync з API).

## 5. Питання (банк у Postgres)

Після оновлення схеми (`server/db/schema.sql` — таблиці `questions`, `question_exclusions`, `question_overrides`):

```bash
npm run questions:import-supabase
```

Публічні ендпоінти (через той самий Express, без `@supabase/supabase-js` на клієнті):

- `GET /api/questions?themeId=&difficulty=&count=`
- `GET /api/questions/by-ids?ids=id1,id2`
- `GET /api/questions/counts?themeId=`
- `GET /api/questions/meta`

`QUESTIONS_PROVIDER=json` — fallback на локальні JSON (dev без БД). За замовчуванням — SQL, якщо задано `DATABASE_URL`.

Перевірка:

```bash
curl "http://localhost:3001/api/questions?themeId=gospels&difficulty=youth&count=5"
```
