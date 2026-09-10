# Bible Games — deployment topology & environment

Phase 2 §19. Accurate as of Phase 2 WS5 (2026-09-09).

The system is a **modular monolith with separately deployable processes**. A
single VPS can host all of them, but each is its own process — its own logs, its
own restart, its own resource budget — and each is described here so an operator
can run, restart and observe it in isolation.

---

## 1. Deployable units

| # | Unit | Command | Binds a port? | Needs Postgres? | Restart safety |
|---|------|---------|---------------|-----------------|----------------|
| 1 | **Frontend static bundle** | `npm run build` → serve `dist/` (CDN / static host / GitHub Pages) | n/a (static) | no | redeploy = atomic swap of `dist/` |
| 2 | **API service** | `npm run server` (`tsx server/index.ts`) | yes — `PORT` (default 3001) | only if `STORAGE_PROVIDER=sql` / `QUESTIONS_PROVIDER=sql` | stateless; safe to kill/restart any time |
| 3 | **Realtime (Socket.IO)** | *currently in the API process* (`createRealtimeServer` inside `createHttpServer`) | shares the API port | no | in-memory room state is lost on restart (acceptable pre-Phase 5); clients resync |
| 4 | **Telegram admin bot** | `npm run bot` (`node bot/index.mjs`) | no | no | admin-only tooling (§16); safe to restart; no user-facing impact |
| 5 | **Background job worker** | `npm run worker` (`tsx server/worker.ts`) | **no** | for the retention sweeps + `content.snapshot`: yes | in-memory queue jobs are lost on restart (durable pg-boss adapter = ADR-014 part 1b); schedules re-arm on boot |
| 6 | **Migration command** | `npm run db:migrate` (`tsx server/infrastructure/database/migrate.ts`) | no | yes | idempotent — journal-guarded, safe to re-run (§18.1) |
| 7 | **Database** | managed Postgres (Supabase / RDS / self-hosted) | 5432 / pooler | — | — |
| — | *Cache / dedicated queue (Redis)* | not used | — | — | deferred; pg-boss keeps the queue in Postgres (ADR-014) |

### Boundary notes

- **Realtime is not yet its own process.** It is a deliberate *logical* boundary
  (`createRealtimeServer`) that today runs inside the API. Splitting it needs a
  shared room/session store (Phase 5) — until then, one API process owns all
  rooms.
- **The worker is mandatory in production if you want retention sweeps and
  content snapshots.** Nothing breaks without it (stale `rate_limit_counters` /
  `idempotency_keys` rows are harmless; the next write overwrites them), but the
  tables grow unbounded.
- **`JOB_SCHEDULES_ENABLED=true` belongs on exactly one process** — the worker.
  If two processes run the schedules, sweeps double-run (harmless but wasteful).
- The **API process does not run schedules**; it may still `enqueue` on-demand
  jobs (e.g. `content.snapshot` after a publish) once that wiring lands.

---

## 2. Health & observability per unit

| Unit | Liveness | Readiness | Metrics |
|------|----------|-----------|---------|
| API | `GET /health/live` | `GET /health/ready` (touches DB + wallet), `GET /health/storage` | `GET /metrics` (in-process counters, JSON) |
| Realtime | shares API health | — | Socket metrics via `/metrics` |
| Bot | process up / Telegram getMe | — | — |
| Worker | process up | — | **structured logs only** (`worker.start`, `job.completed`, `job.failed`); the in-process `metrics` registry is per-process and not exposed from the worker yet — a shared metrics backend is Phase 7 (`server/lib/metrics.ts`) |
| Migration | exit code | — | `drizzle.__migration_runs` table (status + timing) |

All processes emit **one JSON log object per line** (`server/lib/logger.ts`):
`{ ts, level, msg, ...safeFields }`. Never logged: raw Telegram initData, full
profiles, wallet payloads, tokens, `DATABASE_URL`. Correlate with `requestId`
(HTTP), `jobId` + `type` (jobs), `eventId` (realtime).

---

## 3. Environment configuration

Configuration is **environment-specific and typed**. The server parses
`process.env` exactly once in `server/config/env.ts` (`loadConfig()`); domain
code receives a frozen `ServerConfig` and never reads `process.env` directly.
Production hard-fails on incomplete/unsafe config (`assertProductionConfig`).

### 3.1 Frontend (`VITE_*`) — **public, baked into the bundle**

Everything with a `VITE_` prefix is inlined into `dist/` at build time and is
**visible to anyone**. Never put a secret here.

| Var | Purpose | Example |
|-----|---------|---------|
| `VITE_SERVER_URL` | Socket.IO / REST origin | `https://api.example.com` |
| `VITE_API_BASE_URL` | REST base URL | `https://api.example.com` |
| `VITE_BOT_USERNAME` | `t.me/<bot>?startapp=` deep links | `biblegames_bot` |
| `VITE_ADMIN_IDS` | client-side gate for practice-cap editing UI (server re-checks) | `123456789` |
| `VITE_BASE_PATH` | static base path (GitHub Pages) | `/biblegames_bot/` |
| `VITE_FLAG_*` | client feature-flag overrides (registry: `src/lib/flags.ts`) | `VITE_FLAG_TODAY_DASHBOARD=true` |

### 3.2 API service (`server/config/env.ts`)

| Var | Required | Default | Secret | Notes |
|-----|----------|---------|--------|-------|
| `NODE_ENV` | — | `development` | no | unknown value → `production` (fail-closed) |
| `PORT` | — | `3001` | no | |
| `TELEGRAM_BOT_TOKEN` | **prod** | — | **yes** | initData verification |
| `AUTH_MODE` | — | `telegram` | no | `development` is an insecure fixture, blocked in prod |
| `AUTH_INITDATA_MAX_AGE_SEC` | — | `86400` | no | |
| `CLIENT_ORIGIN(S)` | **prod** | localhost | no | comma-separated; https + non-loopback in prod |
| `STORAGE_PROVIDER` | **prod** | `json` | no | **must be `sql` in production** (§26.1 / ADR-016); `sql` needs `DATABASE_URL` |
| `QUESTIONS_PROVIDER` | — | `sql` if `DATABASE_URL` set | no | `json` = local files only |
| `DATABASE_URL` | when `sql` | — | **yes** | Postgres URI; use the pooler for serverless |
| `PG_SSL` | — | `false` | no | `true` for managed Postgres |
| `RBAC_ROLE_GRANTS` / `RBAC_ADMIN_IDS` | — | — | no | config-sourced grants (floor; persisted grants add on top) |
| `QUESTION_ADMIN_FS_WRITES` | — | `false` | no | allow admin question routes to write JSON in prod |
| `MIGRATION_MAX_COINS` | — | `100000` | no | one-time legacy import cap |
| `RATE_LIMIT_DISABLED` | — | `false` (`true` under test) | no | |
| `DEMO_ROUTES_ENABLED` | — | `true` off-prod | no | impossible under `NODE_ENV=production` |
| `CANONICAL_CONTENT_REPOSITORY` | — | `off` | no | `off` / `compare` / `canonical` (§14, §27) |
| `REALTIME_GATEWAY_V2` | — | `false` | no | typed envelopes + sequence/resync (§15) |
| `BOLLS_API_BASE` / `BOLLS_DEFAULT_TRANSLATION` / `BOLLS_CACHE_*` / `BOLLS_FETCH_TIMEOUT_MS` | — | see `.env.example` | no | Scripture text service |

### 3.3 Background job worker (`server/worker.ts`)

Reads the **same `server/config/env.ts`** as the API, plus:

| Var | Required | Default | Secret | Notes |
|-----|----------|---------|--------|-------|
| `JOB_QUEUE_DRIVER` | — | `memory` | no | `postgres` → durable (ADR-014 part 1b, not wired yet — falls back to `memory` with a warn); prod-gate requires `DATABASE_URL` |
| `JOB_SCHEDULES_ENABLED` | — | `false` | no | set to `true` on the worker **only** |
| `OBJECT_STORAGE_DRIVER` | — | `filesystem` | no | `filesystem` / `s3` |
| `OBJECT_STORAGE_DIR` | — | `server/.data/objects` | no | filesystem root |
| `S3_ENDPOINT` | when `s3` | — | no | e.g. `https://s3.us-east-1.amazonaws.com`, `http://minio:9000` |
| `S3_BUCKET` | when `s3` | — | no | |
| `S3_REGION` | when `s3` | — | no | |
| `S3_ACCESS_KEY_ID` | when `s3` | — | **yes** | |
| `S3_SECRET_ACCESS_KEY` | when `s3` | — | **yes** | |
| `S3_KEY_PREFIX` | — | — | no | prefixes every key |

Incomplete `S3_*` config → warning + fallback to `filesystem`.

The API service also loads these vars (same module) but only the worker acts on
`JOB_SCHEDULES_ENABLED`.

### 3.4 Telegram admin bot (`bot/`)

| Var | Required | Secret | Notes |
|-----|----------|--------|-------|
| `BOT_TOKEN` | yes | **yes** | admin bot token (may differ from `TELEGRAM_BOT_TOKEN`) |
| `ADMIN_IDS` | yes | no | comma-separated Telegram user ids |
| `AI_PROVIDER` / `AI_MODEL` / `OLLAMA_*` / `GEMINI_*` / `OMNIROUTE_*` | for AI scripts | `GEMINI_API_KEY`, `OMNIROUTE_API_KEY` **yes** | question-generation tooling only |

### 3.5 Secret inventory

Secrets (**never** in `VITE_*`, never logged, never in `drizzle.config.ts`):
`TELEGRAM_BOT_TOKEN`, `DATABASE_URL`, `BOT_TOKEN`, `S3_ACCESS_KEY_ID`,
`S3_SECRET_ACCESS_KEY`, `GEMINI_API_KEY`, `OMNIROUTE_API_KEY`.

Provision them through the host's secret store / `.env` on the box (gitignored),
not the repo. `.env.example` is the checked-in template.

---

## 4. Standard procedures

### 4.1 Deploy a new version

```
1. build the frontend           npm ci && npm run build         (VITE_* for the target env)
2. run migrations               npm run db:migrate               (idempotent; rehearse on staging first)
3. restart the API service      (stateless — rolling restart is fine)
4. restart the worker           (picks up new schedules on boot)
5. restart the bot              (if bot/ changed)
6. publish dist/                (CDN / static host)
```

Order matters only between 2 and 3: migrations are backward-compatible by
policy (adopt-style `IF NOT EXISTS`, additive columns), so the old API keeps
running against the migrated schema during the restart.

### 4.2 Migrations (§18.1)

- `npm run db:generate` — author a migration offline (no DB); commit the SQL +
  `meta/_journal.json` + snapshot.
- `npm run db:check` — verify journal/snapshot integrity in CI.
- `npm run db:migrate` — apply. Records every run in `drizzle.__migration_runs`
  (status + timing). Journal-guarded: re-running is a no-op.
- **Staging rehearsal is required** before production for any migration that is
  not pure `CREATE TABLE IF NOT EXISTS`.
- Backups: the managed Postgres provider's PITR / daily snapshot is the backup;
  `db:migrate` does not take one. For an irreversible change, land a
  forward-fix migration rather than restoring.

### 4.3 Rollout / rollback

See Phase 2 §27. In short: deploy schema → shadow-read compare
(`CANONICAL_CONTENT_REPOSITORY=compare`, `REALTIME_GATEWAY_V2` off) → migrate
internal users/content → release the API v1 client → switch reads → switch
writes → make legacy stores read-only → drop compatibility after the retention
window. Rollback preserves all new events/ledger/audit and never restores
insecure client writes.

---

## 5. Single-VPS example (systemd)

```ini
# /etc/systemd/system/biblegames-api.service
[Service]
WorkingDirectory=/srv/biblegames
EnvironmentFile=/srv/biblegames/.env
ExecStart=/usr/bin/npm run server
Restart=always

# /etc/systemd/system/biblegames-worker.service
[Service]
WorkingDirectory=/srv/biblegames
EnvironmentFile=/srv/biblegames/.env.worker      # adds JOB_SCHEDULES_ENABLED=true
ExecStart=/usr/bin/npm run worker
Restart=always

# /etc/systemd/system/biblegames-bot.service
[Service]
WorkingDirectory=/srv/biblegames
EnvironmentFile=/srv/biblegames/.env
ExecStart=/usr/bin/npm run bot
Restart=always
```

Three units, one box, three restart boundaries, three log streams
(`journalctl -u biblegames-worker`).
