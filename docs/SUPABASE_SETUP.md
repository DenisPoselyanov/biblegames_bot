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
