# Bible Games — локальні інструменти та команди

> **Тип документа:** локальна operational cheat sheet.  
> **Не є roadmap або архітектурним джерелом правди.**  
> Головна специфікація: [BIBLE_GAMES_MASTER_SPECIFICATION.md](./BIBLE_GAMES_MASTER_SPECIFICATION.md)

## Основні шляхи

- Frontend: `src/`
- Backend: `server/`
- Telegram bot: `bot/`
- Questions: `data/question-db/`
- Topics: `data/topics-db/`
- Scripts: `scripts/`
- Product documentation: `docs/`
- Design rules: `docs/DESIGN_RULES.md`

Локальний шлях на конкретному комп’ютері не є частиною portable configuration. Не коміть hardcoded absolute path у production config.

## Запуск

### Frontend

```bash
npm install
npm run dev
```

```text
http://localhost:5173
```

### Backend

```bash
npm run server:install
npm run server
```

```text
http://localhost:3001
```

### Backend watch mode

```bash
npm run server:dev
```

### Telegram bot

```bash
npm run bot:install
npm run bot
```

## Build і перевірки

Поточні команди:

```bash
npm run build
npm run lint
npm run smoke-audit
npm run test-classification
npm run test-social
npm run test-kahoot
```

Ціль Phase 1:

```bash
npm run typecheck
npm run typecheck:server
npm run test
npm run test:integration
npm run check
```

До появи `npm run check` не вважайте один successful build повною перевіркою.

## GitHub Pages

```bash
npm run build:pages
```

GitHub Pages публікує лише static frontend. Для повного застосунку окремо потрібні:

- API server;
- database;
- Telegram bot;
- background jobs;
- protected content tooling.

## Storage

### Local JSON

```env
STORAGE_PROVIDER=json
```

Підходить для development/tests. Не рекомендується як concurrent production mutation store.

### PostgreSQL/Supabase

```env
STORAGE_PROVIDER=sql
DATABASE_URL=postgresql://...
PG_SSL=true
```

Деталі: `docs/SUPABASE_SETUP.md`.

## Content commands

### Статистика й аналіз

```bash
npm run questions:stats
npm run questions:dedupe-db
npm run analyze-questions
npm run analyze-quality
npm run analyze-explanations
npm run analyze-topics
npm run analyze-pools
npm run scripture:audit
```

### Practice tooling

```bash
npm run balance-questions
npm run fill-practice
npm run fill-practice-nodes
npm run assign-practice-stages
npm run import-practice-stages-list
npm run prune-untagged
```

Перед write commands:

- створіть branch;
- зробіть backup;
- перевірте options;
- використайте dry-run, якщо підтримується;
- перегляньте diff;
- повторіть audits.

## Legacy AI commands

```bash
npm run generate-ai
npm run fix-questions-ai
npm run generate-topics-ai
npm run sort-topics-ai
npm run sort-questions
npm run fix-explanations-ai
npm run ai-topic-edit
npm run topic-conveyor
npm run topic-preview-index
npm run ai-launcher
```

Деталі й safety warning: `docs/AI_SETUP.md`.

До Phase 4 ці команди не є reviewed publication pipeline.

## Корисні документи

| Документ | Призначення |
|---|---|
| `docs/BIBLE_GAMES_MASTER_SPECIFICATION.md` | продукт, архітектура, фази, acceptance criteria |
| `docs/AI_AGENT_MASTER_EXECUTION_PROMPT.md` | готовий промт для виконання фази |
| `docs/DECISIONS.md` | ADR |
| `docs/archive/CURRENT_STATE_AUDIT.md` | історичний baseline |
| `docs/DESIGN_RULES.md` | дизайн-система |
| `docs/archive/DESIGN_AUDIT.md` | історичний UI debt snapshot |
| `docs/DEVELOPER_GUIDE.md` | пояснення коду для початківця |
| `docs/SUPABASE_SETUP.md` | DB/BFF setup |
| `docs/AI_SETUP.md` | legacy AI tooling |

## Безпечний початок нової фази

1. Оновити `main`.
2. Створити branch.
3. Прочитати canonical phase.
4. Використати `docs/AI_AGENT_MASTER_EXECUTION_PROMPT.md`.
5. Запустити baseline checks.
6. Не змішувати unrelated changes.
7. Додати migrations/tests/docs разом із implementation.
8. Відкрити draft PR із точними known limitations.

## Заборонені shortcuts

- production auth через довірений `x-user-id`;
- admin security тільки через прихований UI;
- пряме редагування published content AI-скриптом;
- ручне виставлення coins/rank клієнтом;
- deploy при failed lint/typecheck/tests;
- новий master roadmap;
- нова мікронумерація фаз;
- commit message лише `V2.x` без опису.