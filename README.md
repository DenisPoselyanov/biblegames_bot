# Bible Games — Telegram Mini App

Український застосунок для системного вивчення Біблії, який поєднує навчальні теми, практику, повторення, прогрес, гейміфікацію та групові ігрові режими.

> **Поточний статус:** функціональний alpha / pre-production prototype.  
> Проєкт має багато реалізованих можливостей, але ще не є повністю безпечним production SaaS до завершення Phase 1.

## Документація

Уся актуальна документація зібрана в одному місці:

- **[Відкрити документацію](docs/README.md)**

Основні документи:

- [Головна специфікація](docs/BIBLE_GAMES_MASTER_SPECIFICATION.md)
- [Execution prompt для Codex і Claude Code](docs/AI_AGENT_MASTER_EXECUTION_PROMPT.md)
- [Статус фаз](docs/PHASE_STATUS.md)
- [Архітектурні рішення](docs/DECISIONS.md)

Старі плани, task boards і audits знаходяться в [`docs/archive/`](docs/archive/README.md) та не визначають актуальний порядок робіт.

## Основні можливості

### Навчання

- 7 рівнів складності;
- біблійні теми й підтеми;
- practice flow за темою, складністю, етапом і вузлом;
- повторення помилок;
- mastery, recommendations і streak;
- rank, plaque та wisdom points;
- пояснення й біблійні посилання в частині питань;
- вибір перекладу Біблії.

### Ігрові режими

- Practice;
- Review Mistakes;
- Millionaire;
- Survival;
- Kahoot-подібні кімнати;
- playlists і display mode.

### Інше

- Telegram Mini App і Telegram bot;
- профіль, статистика, косметика та магазин;
- communities і challenges у експериментальному стані;
- Express + Socket.IO backend;
- JSON та PostgreSQL/Supabase storage adapters;
- AI-інструменти генерації й аналізу контенту.

## Відомі production-ризики

До завершення Phase 1 потрібно виправити:

- fail-open identity fallback;
- відсутність повного server authority для progress та economy;
- відсутність повного RBAC й audit trail для admin API;
- demo/in-memory backend flows;
- неповний CI quality gate;
- неперевірену частину question bank;
- відсутність обов’язкового staging → review → publish workflow для AI-контенту.

Детальний порядок виправлень описаний у [головній специфікації](docs/BIBLE_GAMES_MASTER_SPECIFICATION.md).

## Технології

### Frontend

- React 19;
- TypeScript;
- Vite;
- React Router;
- Zustand;
- TanStack React Query;
- react-vant;
- Framer Motion;
- Telegram Web App SDK.

### Backend

- Express;
- Socket.IO;
- JSON development storage;
- PostgreSQL/Supabase adapter;
- окремий Telegram bot package.

## Локальний запуск

Вимоги:

- Node.js 22;
- npm.

### Frontend

```bash
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

### Backend

```bash
npm run server:install
npm run server
```

Backend:

```text
http://localhost:3001
```

### Telegram bot

```bash
npm run bot:install
npm run bot
```

### Production build

```bash
npm run build
```

## Налаштування та робота з проєктом

- [Developer guide](docs/DEVELOPER_GUIDE.md)
- [Локальні команди](docs/LOCAL_TOOLS.md)
- [Design rules](docs/DESIGN_RULES.md)
- [Supabase setup](docs/SUPABASE_SETUP.md)
- [AI tooling setup](docs/AI_SETUP.md)

## Наступний пріоритет

Наступна активна робота після злиття документаційного PR:

**Phase 1 — Production Safety & Engineering Foundation.**

Не починайте нові великі UI, AI, social або monetization-функції раніше за критичні auth, data, CI та content safety завдання Phase 1.
