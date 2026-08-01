# TOOLS.md - Біблійна гра (локальні нотатки)

## Шляхи

- **Проєкт:** `E:\Portfolio\Denis Poselyanov\Telegram\biblegames_bot`
- **Frontend dev:** `http://localhost:5173`
- **Backend:** `http://localhost:3001`
- **AI питання:** `data/question-db/*.json`
- **Теми:** `data/topics-db/` (15 JSON)
- **Telegram bot:** `bot/index.mjs`

## Команди npm (корінь проєкту)

| Команда | Призначення |
|---------|-------------|
| `npm run dev` | Vite frontend |
| `npm run build` | Production build → `dist/` |
| `npm run server:install && npm run server` | Backend Kahoot + API |
| `npm run bot:install && npm run bot` | Telegram bot |
| `npm run questions:stats` | Статистика питань по темах |
| `npm run analyze-quality` | Якість питань |
| `npm run generate-ai -- --theme X --count 50` | Ollama генерація |
| `npm run balance-questions` | Вирівнювання питань між підтемами |
| `npm run ai-launcher` | GUI AI Launcher V3 |
| `Скрипти AI.bat` | Те саме (корінь проєкту) |
| `npm run generate-topics` | AI ієрархія тем |
| `npm run analyze-topics` | Звіт якості тем |
| `npm run scripture:audit` | Аудит reference (потрібен server) |
| `npm run sort-questions` | Сортування по категоріях |
| `npm run lint` | ESLint |

## Storage backend

- `STORAGE_PROVIDER=json` → `server/.data/db.json` (локально)
- `STORAGE_PROVIDER=sql` + `DATABASE_URL` → PostgreSQL/Supabase
- Health: `curl http://localhost:3001/health/storage`

## Telegram Mini App

- BotFather: `/newapp` → URL з HTTPS (Vercel/Netlify/GitHub Pages)
- SDK: `@twa-dev/sdk`
- Menu Button → Web App URL

## Ollama (локальний AI)

- Деталі: `scripts/AI_SETUP.md`
- Генерація питань offline, без API costs

## Безпека

- Не комітити `.env`, bot tokens, `DATABASE_URL`
- `x-user-id` header на backend — не production auth (потрібен Telegram initData verify)

## Open Pencil (дизайн → код)

- **MCP:** `open-pencil` у `.cursor/mcp.json` (проєктний `OPENPENCIL_MCP_ROOT`)
- **CLI:** `openpencil-mcp` (глобально `@open-pencil/mcp@0.13.2`)
- **Файли дизайну:** `design/*.fig` — комітяться в git
- **Десктоп:** Open Pencil має бути запущений + відкритий документ (WebSocket `127.0.0.1:7601`)
- **Токени UI:** `src/index.css` (`--bg`, `--gold`, `--font-serif`, `--font-sans`, spacing, radius)
- **Шрифти:** Cormorant Garamond (заголовки), Source Sans 3 (текст)
- **Типовий flow:** макет у `design/` → MCP `design_to_tokens` / `get_codegen_prompt` → React + CSS modules

### Швидкий старт

1. Запустити Open Pencil (Start Menu → Open Pencil)
2. Cursor → Settings → MCP → перезавантажити `open-pencil`
3. Попросити агента: «Створи макет Home у `design/home.fig`»

