# Phase 2 — Core Architecture & Authoritative Data Platform

> **Priority:** P0/P1 foundation  
> **Depends on:** Phase 1 secure identity, authorization, authoritative mutations and green engineering gates  
> **Blocks:** full learning rebuild, reviewed content platform, social persistence, economy and release hardening  
> **Canonical parent:** [`../BIBLE_GAMES_MASTER_SPECIFICATION.md`](../BIBLE_GAMES_MASTER_SPECIFICATION.md)

---

## Implementation progress

Phase 2 is split into **5 stacked workstreams** (owner decision 2026-09-07):
WS1 contracts + architecture rules + server composition · WS2 persistence platform
(Drizzle, migrations, repositories, persisted RBAC, shared rate-limit/metrics) ·
WS3 canonical content repository + realtime gateway v2 · WS4 frontend data
architecture · WS5 jobs + object storage + deployment + migration cutover + DoD.
Stack confirmed: **Zod + Drizzle + pg-boss** (ADR-013 + ADR-012 + ADR-014 accepted).

WS1–WS4 landed on `main` (PRs #8 `b4d0a34`, #9 `009c5a2`, #10 `1ca59bd`, #11 `f25eca5`).
WS5 in progress on `phase-2/ws5-jobs-storage-deploy`.

### WS1 (done, merged) — PR #8 → `main` `b4d0a34`

- **Contracts (§7, §8):** `contracts/` created — one Zod schema per boundary,
  types inferred, client-safe. `version` / `enums` / `schemas` (primitives, §7.5
  error envelope, snapshots) / `api/{me,progression,shop}` / `events/realtime`.
  `@contracts` alias wired into frontend + server + vitest.
- **Validation:** `validateBody(schema, code?)` middleware on progression
  `/completions` + `/answers`, shop `/purchases`, me `/preferences` +
  `/learning-state`. `.strict()` rejects unknown command keys (§25).
  `AppError` + `errorHandler` emit the §7.5 envelope
  (`messageKey` / `fieldErrors` / `retryable`) alongside legacy `fields`.
  `x-contract-version` response header (§20).
- **Server composition (§4, acc. #10/#11):** `server/app/createRealtimeServer.ts`
  + `createHttpServer.ts` — full HTTP + Socket.IO stack builds in-process with no
  `listen`; `server/index.ts` reduced to the bootstrap and is the only port bind.
- **Domain skeleton (§5, §11):** `server/domains/` ownership map + `shared/context.ts`
  (`ServiceContext`: principal / requestId / injectable clock / opaque tx slot).
- **Architecture tests (§21, §22):** contracts purity + cycle-freedom, `src/ ↛
  server/`, `server/domains ↛ express/socket.io/react`, port-free composition,
  enum parity `contracts ↔ src/types` + `server/authz/roles`.
- **Deferred to WS2:** dependency-cruiser (full-repo cycles + `services ↛ express`),
  move `server/authz` + React client onto `@contracts`, OpenAPI generation.
- `npm run check` green, 167 tests.

### WS2 (done, merged) — PR #9 → `main` `009c5a2`

- **Drizzle spike (ADR-012 → accepted):** `spike/drizzle/` — schema slice of the
  §9 core tables, `contract-bridge.ts` (Drizzle `InferSelectModel` composes with
  `@contracts` as storage types behind the repository seam — §25 trap avoided by
  rule), `repositories.ts` (§10 interfaces + Drizzle adapter + in-memory parity
  peer, `Transaction` → `ServiceContext.tx`), generated migration
  `0000_clammy_owl.sql` + journal v7 + checksummed snapshot (offline, no DB).
  `drizzle-orm@0.44.7` / `drizzle-kit@0.31.10`; `npm run check` stays green.
  Findings: `spike/drizzle/FINDINGS.md`.
- **Persistence platform + migration framework (§9, §18.1):**
  `server/infrastructure/database/` — Drizzle over the shared `pg.Pool`
  (`client.ts`), per-domain `schema/` adopted 1:1 from `server/db/schema.sql`
  (11 tables), `migrate.ts` runtime runner (`npm run db:migrate`: drizzle
  migrator + status/timing log + `drizzle.__migration_runs`), `testing.ts`
  pglite in-process DB for contract tests. `drizzle.config.ts` +
  `server/migrations/0000_violet_dagger.sql` (hand-edited to `IF NOT EXISTS` so
  it adopts the Phase 1 tables, no data move) + journal v7 + checksummed
  snapshot. `db:generate`/`db:check` run `drizzle-kit` via `npx` — not a dep;
  runner needs only `drizzle-orm`. `drizzle-orm` → deps, `@electric-sql/pglite`
  → devDeps (lock in sync, `npm ci` clean). `npm run check` green, 172 tests.
- **Identity + RBAC tables + repositories (§5.1, §9, §10):** `schema/identity.ts`
  — `users`, `external_identities`, `roles`, `user_roles` (grant w/ provenance +
  `revoked_at`), `user_preferences`. Migration `0001_nosy_cable.sql` (new tables,
  plain create) + seeds `roles` from `ROLES`. `server/domains/identity/` —
  `UserRepository` / `RoleRepository` interfaces + domain types (ORM-free),
  `inMemoryRepository.ts` peer. SQL adapter
  `infrastructure/database/repositories/identity.ts` (opaque `Transaction` →
  Drizzle executor narrowed in one place). Shared `repositoryContract.ts` runs
  against in-memory **and** pglite. `npm run check` green, 184 tests.
- **Persisted RBAC wired into the request path (§9, closes ADR-011):**
  `RoleResolver` is the one async seam — `attachPrincipalRoles` runs after
  `requireAuthenticated` and stamps the resolved roles+permissions onto
  `req.authz`; `policy.ts` and `routes/me.ts` are now synchronous readers of it.
  `createPersistedRoleResolver` reads `user_roles` and unions the config grants
  as an **un-revokable floor** (per-user cache + `invalidate` on change: `ttlMs`
  30s for plain users, `privilegedTtlMs` 5s for anyone with an elevated role so a
  cross-instance revoke propagates fast; store-read failure degrades to the
  floor, never a 500). `attachPersistedIdentity` (`server/authz/principalIdentity.ts`)
  upserts every authenticated principal into `users` + `external_identities` on
  first sight (spec §11 `IdentityService.resolveTelegramUser`) — without it
  `users` stays empty in prod and every runtime grant 404s. `roleService` =
  runtime grant/revoke (provenance, audit `rbac.role_granted`/`_revoked`, cache
  invalidation, self-admin-revoke guard, `user_not_found` on grant **and**
  revoke). `routes/adminRoles.ts` — `GET/POST/DELETE /api/v1/admin/roles/:userId`,
  `admin`-only, mounted only when a persisted identity store is wired.
  `contracts/api/admin.ts` for the surface. `AppDeps.database` (Drizzle over the
  shared pool) selects the persisted path; `server/db/pgPool.ts` now types the
  one shared `pg.Pool`. eslint bans `drizzle-*` imports from `contracts/`.
  Proper cross-instance cache invalidation (pg `LISTEN/NOTIFY`) is a Phase 7
  item. `npm run check` green, 205 tests.
- **Shared rate-limit store (§13, closes the Phase 1 handoff):** fixed-window
  counting moved behind a `RateLimitStore` interface
  (`server/middleware/rateLimitStore.ts`). `createMemoryRateLimitStore` is the
  default; `createSqlRateLimitStore` (`rate_limit_counters`, migration `0002`)
  is selected when `AppDeps.database` is wired — one atomic
  `INSERT … ON CONFLICT DO UPDATE` per hit, the window rolls inside the `CASE`,
  so instances cannot race past the limit. `hitLimit` / `allowSocketEvent` are
  now async and **fail open** on a store outage (`rate_limit_store_error_total`).
  Shared contract test runs the memory + pglite adapters. Metrics stay
  in-process (cross-instance = a real backend; Phase 7). `npm run check` green,
  215 tests.
- **Review fixes (PR #9):** identity-upsert step wired into the authed chain
  (runtime grant was 404-only in prod without it); `roleService.revoke` now
  mirrors `grant`'s `user_not_found` check; resolver cache split into plain vs
  privileged TTL; `createRateLimit` async path routes a late `res.setHeader`
  throw to the error handler instead of an unhandled rejection; `migrate.ts`
  `appliedCount` only swallows "state not created yet", rethrows real failures.
  `npm run check` green, 225 tests.
- Flag `legacyStoreReadOnly` and the JSON→SQL profile cutover are WS5.

### WS3 (done, merged) — PR #10 → `main` `1ca59bd`

- **Canonical content revision model + read contract (§9, §10, §14):**
  `@contracts/schemas/content.ts` — `questionRevision` (`.strict()`, rejects a
  `correctIndex` out of range for the options given — no first-option fallback),
  `scriptureReference`, `publishedQuestion` read projection, `publishedContentSet`
  (stable `version` + sha-256 `contentHash`), `contentSetFilter`. Drizzle
  `schema/content.ts` += `question_revisions` (numbered; partial unique index =
  one `published` revision per question), `scripture_references`, `content_sets`
  / `content_set_versions` / `content_set_items`; migration `0003` (all-new
  tables). `server/domains/content/` — `types.ts`, `contentHash.ts` (key-sorted
  sha-256 body/set hash = the dedup + version identity), `repository.ts`
  (`QuestionRevisionRepository`, `ContentSetRepository`), `inMemoryRepository.ts`.
  SQL adapter `infrastructure/database/repositories/content.ts`. Shared contract
  test runs against in-memory **and** pglite.
- **Legacy import + validation pipeline (§14, §18.3):**
  `domains/content/validation.ts` `validateQuestion` is the ingestion gate — it
  never defaults a missing/out-of-range `correctIndex` to 0; coerces messy legacy
  field types. `import.ts` `importLegacyQuestions` — valid → `legacy_unreviewed`
  (idempotent by body hash); answer-key-only fault → imported then quarantined
  with a reason; structurally broken → rejected and listed. `snapshot.ts`
  `buildSnapshot` — a static snapshot is an **output**, never read back as a
  source. `scripts/content/import-legacy-questions.ts`
  (`npm run content:import-legacy`, `--dry`). Dry run over the whole corpus:
  89,034 questions, 0 rejected, 0 quarantined.
- **Read-path cutover behind a flag (§14, §23, §27):**
  `CANONICAL_CONTENT_REPOSITORY` = `off` (default) / `compare` (serve legacy,
  read canonical too, log every id-set divergence —
  `content_source_divergence_total`) / `canonical` (serve published revisions,
  legacy only as an empty-result fallback). `server/services/contentQuery.ts`
  maps a revision to the legacy `Question` shape; `questionService.ts`
  `configureCanonicalContent()` seam + `fetchQuestions()` dispatcher at the five
  question-serving call sites. `getQuestionCounts` / `getQuestionsMeta` stay on
  legacy for now. `server/app.ts` derives `contentRepositories` from
  `deps.database`.
- **Realtime gateway v2 behind `REALTIME_GATEWAY_V2` (§15, acc. #11):**
  `server/realtime/clock.ts` (`Clock` service, injectable), `roomEventGateway.ts`
  — wraps the room broadcast in a typed `RealtimeEvent` envelope with a per-room
  monotonic `sequence` and `serverTime`; `resync_room` command returns the
  current envelope plus whether the client fell behind. `createRealtimeServer`
  emits `room_event` alongside the legacy `room_state` when the flag is on. Client
  (`useKahootRoom` / `kahootSocket`) applies envelopes by sequence (drops
  replays), resyncs on reconnect — timers and victory animations are driven off
  room state, never restarted (§24). Contracts: `roomEventEnvelope`,
  `resyncRoomCommand` / `resyncRoomAck`, `SERVER_EVENT_TYPES`.
- **Bot integration boundary (§16):** the Telegram bot (`bot/index.mjs`) is
  admin-only AI question generation tooling — no progression / purchase / Mini
  App / notification logic. Its `/generate` writes to the staging
  `data/question-db/*.json` that now flows through the validated import above;
  full migration onto a backend authoring API is a Phase 4 Content Studio item.
  `bot/README.md` records the constraint; an architecture test pins that the bot
  imports no `server/` runtime module.
- **Deferred to WS5:** `getQuestionCounts` / `getQuestionsMeta` canonical
  cutover, client `questionDbLoader` cutover, realtime room/session SQL
  repository (in-memory only for now), `legacyStoreReadOnly` + the JSON→SQL
  snapshot cutover.

### WS4 (done, merged) — PR #11 → `main` `f25eca5`

Frontend data architecture (§13). `npm run check` green, 289 tests.

- **Typed API client (§13.4, part 1 `fb7bf00`):** one `src/lib/apiClient` —
  attaches the Telegram principal, propagates a per-request id, parses the §7.5
  error envelope into a typed `ApiError` (`code`, `requestId`), validates every
  response against a Zod contract, aborts via `AbortSignal`, and never retries a
  non-idempotent command without an idempotency key. `progressionRepo` /
  `playerRepo` / `statsRepo` / `studyRepo` sit on it.
- **Query-key factory + cache defaults (§13.2, §13.3, part 2 `82f84f5`):**
  `src/queries/keys.ts` — the single hierarchical key factory (`me.*`,
  `learning.*`, `practice.*`, `content.*`, `kahoot.*`); `OFFLINE_CACHEABLE_PREFIXES`
  / `isOfflineCacheable` **define** the disk-persistence allowlist (last profile
  snapshot + published content only — never wallet / rank / live result). Wiring a
  React Query persister to that gate is deferred to WS5; today only the profile
  snapshot + preferences are cached, via the zustand persist middleware.
- **Provider decomposition (§13.1, part 3 `10022c2`):** `AuthSessionProvider`
  (one principal, `initTelegramWebApp()` once, outermost) · `usePreferences`
  (the client-owned write surface — `activeTheme` / `avatar` /
  `bibleTranslation`) · `usePersistProfile` (the one client write path: mark
  store dirty → set store → preference-whitelist PATCH) · `CosmeticThemeSync`
  (theme application, was an effect inside the provider). Store gains a
  non-persisted `dirty` flag; the ref-based dirty seam is gone.
- **Domain hooks (§13.1, part 4 `78f8178`):** `useProgression`
  (level / practice-stage / survival / millionaire / achievements / answers),
  `useEconomy` (theme + avatar purchase), `useLearningInsights`
  (recommendations + daily plan), `useResolvedProfile` / `useProfileWriter`
  (profile resolution + mutators). `progressionOutcome.ts` shares
  `authoritativeEnabled()` + `applyOutcome()`.
- **PlayerContext retired (§13.1, part 5 `00c797f`):** the aggregate
  `PlayerContext` / `usePlayer` / `PlayerProvider` are deleted; all 12 consumers
  read the focused hooks (`useGlobalStats(userId)` is the new stats read-view).
  `PlayerDataBootstrap` keeps the server→store sync + session telemetry mounted
  once near the root.
- **Deferred to WS5:** the React Query persister wired to `isOfflineCacheable`,
  and offline reconciliation for pending safe commands (§13.3 bullet 3 — only
  preferences + last snapshot are cached today).

WS4 landed on `main` (PR #11, merge `f25eca5`).

### WS5 (in progress) — branch `phase-2/ws5-jobs-storage-deploy`

Jobs, storage, deployment, migration cutover & DoD (§17–§20, §26, §27). Off main `f25eca5`.

- **Background jobs abstraction + ADR-014 (§17, part 1):** `server/domains/jobs/`
  — a pure `JobQueue` interface (`register` / `enqueue` / `start` / `stop` /
  `stats`), a `JobRecord` carrying every §17 field (id, type, status, attempts,
  timestamps, error, checkpoint, idempotency), and a `catalog.ts` of well-known
  types each with a Zod payload schema. The **in-memory adapter**
  (`inMemoryQueue.ts`) is the default and the only option with no DB: poll loop,
  capped-exponential backoff, dead-letter after `maxAttempts`, `AbortSignal` on
  stop, `runDue()` test hook. The durable Postgres/pg-boss adapter is **part 1b
  (deferred, fast-follow)** — a 2026-09-09 spike found `pg-boss@12` `boss.start()`
  hangs under pglite, so its contract test needs a real Postgres in CI;
  `JOB_QUEUE_DRIVER=postgres` currently falls back to in-memory with a loud warn.
  A dedicated
  **worker process** (`server/worker.ts`, `npm run worker`) runs the queue and,
  when `JOB_SCHEDULES_ENABLED=true`, the recurring maintenance jobs — it never
  binds a port. First handlers: three retention sweeps (`rate_limit_counters`,
  `idempotency_keys`, `telemetry_events`), each one bounded `DELETE`, on a 6h
  schedule. Metrics: `jobs_{enqueued,started,completed,retried,failed}_total{type}`.
  ADR-014 → accepted. `npm run check` green, 305 tests (+16).

- **Object storage adapter + ADR-015 (§19, part 2):** `server/domains/storage/`
  — an `ObjectStore` interface (`put` / `get` / `head` / `delete` / `list`) for
  platform **outputs** (content snapshots now; export bundles + AI artifacts +
  media later). The **filesystem adapter** is the default (one file per key +
  a `.meta` sidecar, atomic writes, `OBJECT_STORAGE_DIR`). The **S3 adapter**
  (`OBJECT_STORAGE_DRIVER=s3`) talks S3 REST over `fetch` with a hand-rolled
  SigV4 (`sigv4.ts`, verified against the AWS `aws4_testsuite` vectors) — no
  `aws-sdk`; works with AWS / MinIO / R2 / B2. A memory adapter backs tests;
  all three pass one `objectStoreContract`. The `content.snapshot` job
  (`buildSnapshot` → `ObjectStore`) writes `snapshots/<setId>/<hash>.json` +
  `latest.json` and is registered on the worker when content wiring is present.
  ADR-015 → accepted. `npm run check` green, 323 tests (+18).

- **Deployment topology + typed env (§19, part 3):** `docs/DEPLOYMENT.md` — the
  7 deployable units (frontend bundle, API, realtime [still in-process, explicit
  boundary], bot, job worker, migration command, database), each with its run
  command, port, restart safety and health/observability. A full env-var
  reference per unit, split public (`VITE_*`, baked into the bundle) vs
  server-only, with a secret inventory (`TELEGRAM_BOT_TOKEN`, `DATABASE_URL`,
  `BOT_TOKEN`, `S3_*` keys, AI keys — never in Vite, never logged). Deploy /
  migration / rollout procedures and a single-VPS systemd example.
  `.env.example` + `docs/README.md` updated. Docs-only.

- **Observability standardization (§20, part 4):** `docs/OBSERVABILITY.md` — the
  log schema (`level` reserved), the ID taxonomy (`requestId` / `jobId`+`type` /
  `eventId`), and the full metric catalog. New instrumentation: `httpMetrics`
  middleware (`http_requests_total{method,status}`, `http_server_errors_total`,
  `http.slow_request` warn ≥ 1s); `instrumentPool` wraps `pg.Pool.query`
  (`db_queries_total{op}` where `op` = `<verb> <table>`, `db_slow_queries_total`
  ≥ 200ms, `db_query_errors_total`). Frontend: `src/lib/errorReporter.ts`
  (`window.onerror` + `unhandledrejection` + `ErrorBoundary`) → `POST
  /api/v1/client-errors` (`contracts/api/observability.ts`, `.strict()`,
  unauthenticated, 30/min per IP) sending only `{ route, buildVersion, code,
  level, message? }` — never a stack or payload. `__APP_VERSION__` baked in by
  Vite (`VITE_BUILD_ID` | `<pkg>-dev`). `npm run check` green, 337 tests (+14).

- **Legacy profile decomposition — preferences (§18.2, part 5):** the typed
  `user_preferences` table (migration `0001`) gets its first authoritative use.
  New `PreferencesRepository` (`server/domains/identity/preferences.ts`) — SQL
  adapter + in-memory peer, in the shared identity contract test. `writePreferences`
  / `readProfile` now **dual-write** the whitelist fields with a typed home
  (`activeTheme` / `avatar` / `bibleTranslation`) to `user_preferences` and
  overlay them on read; the blob copy stays in sync during the verification
  window. `LEGACY_STORE_READONLY=true` freezes those three fields in the blob
  (typed store becomes authoritative). Backfill:
  `npm run migrate:backfill-preferences [--dry]` (idempotent, reports
  scanned/written/unchanged/no-user-row). `displayName` and the
  progression/entitlement fields are **not** decomposed yet — see below.
  `npm run check` green, 342 tests (+5).

  *Remaining §18.2 work (post-Phase-2 rollout, §27 step 9):* typed tables +
  repositories for progression state (level/xp/rank/streak) and
  achievements/entitlements, their backfill with a `migration_records`-style
  provenance row and count/sum verification, then the legacy write-path removal
  once rollout evidence is in. The framework (dual-write + `LEGACY_STORE_READONLY`
  + backfill pattern) is in place; `player_stats` / `player_profiles` blobs stay
  authoritative for those fields until then.

---

## 1. Product outcome

After Phase 2, Bible Games has one canonical backend/data architecture instead of several partially overlapping systems. Frontend, bot, server, realtime and scripts share contracts without sharing unsafe implementation. The project can evolve in later phases without duplicating progression rules, question loading, profile schemas or error handling.

The phase transforms the Phase 1 safety foundation into a maintainable platform.

---

## 2. Current architectural tensions

### Frontend state and domain logic are intertwined

`src/context/PlayerContext.tsx` currently performs UI state, local fallback, API sync, progression calculation, purchases, achievements, telemetry and theme application in one provider. Even after Phase 1 removes client authority, this provider would remain too broad if it merely wraps new endpoints.

### Server composition is centralized

`server/index.ts` currently combines app configuration, route mounting, demo routes, storage selection, Socket.IO setup, room handlers and startup. This limits testability and creates hidden dependencies.

### Multiple data paths exist

The application contains:

- localStorage/Zustand profile state;
- JSON server store;
- SQL server store;
- static question JSON and loaders;
- question admin overrides;
- in-memory demo arrays;
- in-memory/realtime Kahoot room state;
- exported Kahoot sessions;
- scripts that directly read/write content files.

### Shared types are not the same as shared contracts

The server imports types from `src/`, but frontend-oriented types may include fields or assumptions inappropriate for authoritative persistence. A type import alone does not enforce runtime validation, versioning or compatibility.

### Deployment concerns are mixed

Static frontend, Express API, Telegram bot, Socket.IO, background AI/content jobs and migrations have different runtime needs but are not yet represented as explicit deployment units.

---

## 3. Architecture principles

1. One repository remains unless a later ADR proves independent deployment/package requirements.
2. Domain logic has explicit ownership.
3. Runtime validation occurs at every process/network boundary.
4. Shared contracts are versioned and do not expose server internals.
5. Frontend sends intent and renders outcomes; it does not own authoritative business rules.
6. JSON is a development/import/export/static snapshot format, not the default mutable production database.
7. Repositories hide persistence providers behind tested contracts.
8. Background jobs and realtime use the same domain services as HTTP where appropriate.
9. Migrations are first-class, repeatable and observable.
10. Later phases extend domains rather than creating parallel implementations.

---

## 4. Target logical structure

The exact directories can evolve, but responsibilities should approach:

```text
src/
├── app/
│   ├── providers/
│   ├── routing/
│   └── queryClient/
├── domains/
│   ├── identity/
│   ├── learning/
│   ├── progression/
│   ├── economy/
│   ├── content/
│   ├── social/
│   ├── realtime/
│   └── settings/
├── components/
├── pages/
├── lib/
└── contracts/            # generated/shared client-safe types only

server/
├── app/
│   ├── createApp.ts
│   ├── createHttpServer.ts
│   └── createRealtimeServer.ts
├── config/
├── domains/
│   ├── identity/
│   ├── learning/
│   ├── progression/
│   ├── economy/
│   ├── content/
│   ├── social/
│   └── realtime/
├── infrastructure/
│   ├── database/
│   ├── repositories/
│   ├── logging/
│   ├── jobs/
│   └── cache/
├── routes/
├── realtime/
└── migrations/

shared-or-contract-source/
├── schemas/
├── api/
├── events/
└── enums/
```

This does not require a published package. A local contract source can be generated into frontend/server outputs. The rule is one source, runtime validation and controlled dependencies.

---

## 5. Domain ownership

## 5.1 Identity

Owns:

- authenticated principal;
- Telegram identity mapping;
- account status;
- roles/permissions;
- sessions;
- account lifecycle;
- privacy/export/delete request state.

Does not own profile cosmetics, progression or group membership.

## 5.2 Learning

Owns:

- learning plans;
- modules;
- lessons;
- learning objectives;
- practice/review sessions;
- answer attempts;
- mastery inputs;
- daily plan generation interface.

Does not own question publication lifecycle; it consumes published content from Content.

## 5.3 Progression

Owns:

- XP/wisdom;
- levels;
- ranks;
- streak;
- achievements;
- reward eligibility;
- progression outcomes.

Does not own monetary payments or catalog definitions.

## 5.4 Economy

Owns:

- internal wallet;
- ledger;
- transaction/reversal;
- catalog prices only after Phase 6;
- entitlements;
- purchase outcomes.

Does not own learning completion rules.

## 5.5 Content

Owns:

- canonical question/lesson schemas;
- published revisions;
- topic hierarchy;
- Scripture references;
- content repository;
- draft/review/publication later in Phase 4.

Does not own user answer history.

## 5.6 Social

Owns:

- communities;
- membership;
- friend/challenge relationships;
- leaderboards;
- privacy/moderation policies.

Detailed implementation waits for Phase 5, but boundaries and IDs are defined now.

## 5.7 Realtime

Owns:

- room/session state transport;
- server time synchronization;
- reconnect tokens;
- event sequencing;
- broadcast delivery.

Game scoring remains in authoritative game/domain services, not in UI event handlers.

---

## 6. Canonical IDs and entity rules

Every persisted entity uses a stable opaque ID. Do not rely on mutable names, route labels or Telegram usernames.

Required identity categories:

- `userId` — internal stable user ID;
- `telegramUserId` — external identity mapping;
- `contentId` and `contentRevisionId`;
- `learningObjectiveId`;
- `planId`, `moduleId`, `lessonId`;
- `practiceSessionId`, `answerAttemptId`;
- `progressionEventId`;
- `walletTransactionId`;
- `entitlementId`;
- `communityId`, `membershipId`, `challengeId`;
- `roomId`, human-readable room code and session ID;
- `auditEventId`.

Human-readable codes can change or expire. Internal relations use stable IDs.

---

## 7. Canonical schemas

## 7.1 User profile

Split profile into authoritative and preference projections.

```ts
interface UserProfileView {
  user: {
    id: string;
    displayName: string;
  };
  preferences: {
    bibleTranslation: string;
    activeThemeId: string;
    avatarId: string;
    locale: string;
    timezone: string;
    motionIntensity: 'full' | 'reduced' | 'minimal';
    hapticsEnabled: boolean;
  };
  progression: ProgressionSnapshot;
  wallet: WalletSnapshot;
  entitlements: EntitlementSummary[];
  version: number;
}
```

Do not persist the entire view as one mutable JSON blob if different domains require transactional ownership.

## 7.2 Progression outcome

```ts
interface ProgressionOutcome {
  eventId: string;
  sourceType: 'answer' | 'practice_completion' | 'lesson_completion' | 'game_result' | 'migration' | 'admin_adjustment';
  sourceId: string;
  occurredAt: string;
  previous: ProgressionSnapshot;
  next: ProgressionSnapshot;
  delta: ProgressionDelta;
  grantedAchievements: AchievementGrant[];
}
```

The event ID is the key for motion/notification deduplication.

## 7.3 Economy outcome

```ts
interface EconomyOutcome {
  eventId: string;
  transactionIds: string[];
  previousBalance: number;
  nextBalance: number;
  delta: number;
  entitlementChanges: EntitlementChange[];
  occurredAt: string;
}
```

## 7.4 Game outcome

```ts
interface GameOutcome {
  eventId: string;
  gameType: 'practice' | 'survival' | 'millionaire' | 'kahoot';
  sessionId: string;
  userId: string;
  finalScore: number;
  placement?: number;
  rewards?: ProgressionDelta;
  completedAt: string;
}
```

## 7.5 Error envelope

```ts
interface ApiErrorEnvelope {
  error: {
    code: string;
    messageKey: string;
    requestId: string;
    fieldErrors?: Record<string, string[]>;
    retryable: boolean;
  };
}
```

All routes use the same envelope.

---

## 8. Runtime schema strategy

Choose one runtime validation approach for contracts, such as Zod/Valibot/JSON Schema plus generation. The exact library requires an implementation decision, but requirements are fixed:

- TypeScript types derive from or are checked against runtime schemas;
- schemas have explicit versions;
- backward-compatible fields are optional with defaults only when semantically safe;
- invalid critical values are rejected, not silently coerced;
- schemas are usable by HTTP, Socket.IO, imports and tests;
- generated OpenAPI or equivalent documentation is possible;
- frontend does not import database models.

Avoid two independent schemas in `src/` and `server/`.

---

## 9. Database model foundation

Phase 2 defines and migrates core tables. Exact naming can vary.

### Identity/account

- users;
- external identities;
- roles;
- permissions;
- user roles;
- sessions if used;
- account status;
- privacy requests.

### Preferences

- user preferences with schema version;
- theme/avatar selections;
- locale/timezone/accessibility/motion settings.

### Learning/progression

- learning plans/modules/lessons/objectives metadata;
- practice sessions;
- answer attempts;
- lesson completion;
- mastery/progress snapshots or event-derived state;
- streak days/events;
- progression events;
- achievement grants.

### Economy baseline

- wallets;
- wallet transactions;
- entitlements;
- migration records.

### Content baseline

- content items;
- revisions;
- publication state;
- topic/objective relations;
- static snapshot/version metadata.

### Realtime/social placeholders

Tables may be introduced minimally for:

- rooms/sessions;
- community/challenge IDs;
- session exports.

Do not fully implement Phase 5 behavior yet.

---

## 10. Repository contracts

Create repository interfaces with contract tests.

Examples:

```ts
interface UserRepository {
  getById(id: string): Promise<User | null>;
  getByTelegramId(telegramId: string): Promise<User | null>;
  createFromTelegram(...): Promise<User>;
}

interface ProgressionRepository {
  getSnapshot(userId: string, tx?: Transaction): Promise<ProgressionSnapshot>;
  appendEvent(event: ProgressionEvent, tx: Transaction): Promise<void>;
  saveSnapshot(snapshot: ProgressionSnapshot, tx: Transaction): Promise<void>;
}

interface ContentRepository {
  getPublishedQuestion(id: string): Promise<PublishedQuestion | null>;
  listPublishedQuestions(filter: QuestionFilter): Promise<PublishedQuestion[]>;
  getPublishedRevisionSet(version: string): Promise<PublishedContentSet>;
}
```

The SQL adapter is production. JSON adapters may remain for fixtures/dev/import/export but must pass the same read contracts where relevant.

Do not force JSON to emulate unsupported transactions for production writes.

---

## 11. Service layer

HTTP, Socket.IO, bot and jobs call domain services.

Examples:

- `IdentityService.resolveTelegramUser`;
- `PracticeService.createSession`;
- `PracticeService.submitAnswer`;
- `ProgressionService.applyCompletion`;
- `WalletService.applyTransaction`;
- `ThemePreferenceService.selectOwnedTheme`;
- `KahootService.createRoom`;
- `ContentQueryService.getQuestionSet`.

Services accept explicit principal/context and transaction boundaries. They do not depend on Express request objects or React types.

---

## 12. API architecture

## 12.1 Versioning

Adopt a versioned API prefix:

```text
/api/v1/...
```

Version only when contract compatibility requires it. Do not embed implementation version numbers in every route.

## 12.2 Resource design

Self-scoped examples:

```text
GET   /api/v1/me
GET   /api/v1/me/progress
PATCH /api/v1/me/preferences
GET   /api/v1/me/entitlements
```

Learning examples:

```text
GET  /api/v1/learning/today
GET  /api/v1/learning/plans
POST /api/v1/practice/sessions
POST /api/v1/practice/sessions/:id/answers
POST /api/v1/practice/sessions/:id/complete
```

Admin/content route names remain internal until Phase 4.

## 12.3 Pagination/filtering

Use consistent cursor or page contracts. Large question/content collections must never be returned as uncontrolled full dumps to the client.

## 12.4 Request context

Each service call receives:

- authenticated principal;
- request ID;
- locale/timezone where required;
- transaction context;
- feature flag context;
- audit metadata.

---

## 13. Frontend data architecture

## 13.1 Provider decomposition

Reduce `PlayerContext` responsibilities. Target separation:

- auth/session provider;
- query client for server data;
- lightweight preferences/theme provider;
- domain hooks for practice/progression/economy;
- no giant context exposing all mutations.

Zustand may store transient/local UI state, but authoritative server state should use React Query or equivalent cache with stable query keys.

## 13.2 Query keys

Define domain keys:

```text
['me']
['me', 'progress']
['me', 'wallet']
['learning', 'today']
['learning', 'plan', planId]
['practice', 'session', sessionId]
['content', 'publishedVersion']
['kahoot', 'room', roomId]
```

Avoid duplicating the same profile object in Context, Zustand, localStorage and Query cache.

## 13.3 Offline/local cache boundary

Phase 2 defines what may be cached:

- preferences and last server snapshot;
- published immutable content by version;
- pending safe commands only when reconciliation exists;
- consumed event IDs for motion deduplication.

Wallet, rank and current competitive result are never trusted solely from local cache.

## 13.4 API client

Create one typed API client that:

- attaches auth;
- propagates request IDs;
- parses error envelope;
- validates responses;
- handles retry policy by mutation safety;
- supports abort signals;
- never automatically retries non-idempotent commands without an idempotency key.

---

## 14. Content repository consolidation

Current question delivery uses static loaders, embedded/JSON data and optional SQL paths. Phase 2 must define one read contract.

### Target

- a published content set has a stable version/hash;
- questions reference objectives/topics;
- Quiz, Kahoot and lesson practice request filtered sessions or published subsets;
- scripts import into staging/canonical repository rather than bypassing it;
- static snapshots can be generated for offline/dev but are outputs, not competing sources;
- invalid `correctIndex` is rejected/quarantined;
- first-option fallback disappears.

Phase 4 performs full quality workflow; Phase 2 establishes repository and revision structure.

---

## 15. Realtime architecture

Refactor Socket.IO handling into:

- authenticated connection middleware;
- typed client/server event schemas;
- room gateway/transport;
- authoritative game service;
- room/session repository;
- timer/clock service;
- cleanup/recovery worker.

Event envelopes should include:

```ts
interface RealtimeEvent<T> {
  eventId: string;
  roomId: string;
  sequence: number;
  serverTime: string;
  type: string;
  payload: T;
}
```

Clients use sequence/server time to recover from reconnect without restarting timers or replaying victory animations.

Full social/multiplayer behavior remains Phase 5.

---

## 16. Bot integration boundary

The Telegram bot should not contain duplicate progression, purchase or content rules.

Target bot responsibilities:

- launch Mini App;
- deep links/invitations;
- approved notifications/reminders;
- payment or subscription entry where allowed;
- administrative commands only through authenticated backend APIs;
- no direct production database writes;
- no duplicate question mutation pipeline.

Bot and Mini App share server APIs and identity mapping.

---

## 17. Background jobs

Introduce a job abstraction for:

- content import/indexing;
- future AI generation;
- publication snapshot creation;
- telemetry aggregation;
- cleanup/expiry;
- emails/notifications if later required.

Job contract includes ID, type, status, attempts, created/started/completed time, error, checkpoint and idempotency. Phase 4 expands this for AI.

Avoid embedding long jobs inside HTTP requests.

---

## 18. Migrations

## 18.1 Migration framework

Required properties:

- ordered migration IDs;
- transaction where supported;
- migration journal;
- checksum;
- status and timing;
- safe rerun policy;
- staging rehearsal;
- backup/restore steps;
- forward-fix plan for irreversible changes.

## 18.2 Legacy profile decomposition

Migrate whole profile blobs into domain tables without losing provenance.

Order:

1. create new tables;
2. copy validated preferences;
3. create progression migration event;
4. create wallet opening transaction;
5. create achievement/entitlement grants with migration source;
6. verify counts and sums;
7. mark migrated profile version;
8. keep legacy blob read-only during verification window;
9. remove legacy write path only after rollout evidence.

## 18.3 Content migration

Import existing question files as revisions with status such as `legacy_unreviewed`, not automatically `published_reviewed`.

---

## 19. Deployment topology

Document and support separate deployable responsibilities:

- frontend static bundle/CDN;
- API service;
- Socket.IO/realtime service, initially possibly same process but explicit boundary;
- Telegram bot worker;
- background job worker;
- migration command;
- database;
- optional cache/queue later.

A single VPS may host multiple processes, but they remain separately observable and restartable.

Configuration is environment-specific and typed. Secrets are not bundled into Vite.

---

## 20. Observability

Standardize:

- structured log schema;
- request/event/job IDs;
- domain event logging;
- database query timing;
- API latency/error metrics;
- Socket.IO room/connection metrics;
- migration metrics;
- job queue metrics;
- content version in responses/logs;
- safe user correlation ID.

Frontend error reporting includes route, build version and safe error code, not full private payloads.

---

## 21. Dependency rules

Add lint or architecture tests:

- frontend cannot import `server/`;
- server domain cannot import React/pages;
- domain services cannot import Express/Socket.IO directly;
- infrastructure implements domain interfaces;
- pages may depend on domain hooks/components, not database models;
- scripts use content/job services rather than internal repository files where possible;
- shared contracts cannot import provider-specific infrastructure.

Circular dependencies fail CI.

---

## 22. Testing strategy

### Contract tests

- JSON dev and SQL read adapters where parity is intended;
- API response validation;
- Socket event validation;
- migration fixtures;
- error envelope.

### Domain tests

- progression outcomes;
- wallet transaction invariants;
- mastery/streak boundaries;
- content query filters;
- idempotency/replay;
- permission policy.

### Integration tests

- authenticated API with test database;
- transaction rollback;
- practice session lifecycle;
- legacy migration;
- socket authentication and reconnect;
- bot API call boundaries where practical.

### Architecture tests

- forbidden imports;
- duplicate schema definitions;
- unversioned persisted entities;
- public route exposure.

---

## 23. Feature flags and compatibility

Suggested flags:

- `apiV1ReadModel`;
- `profileProjectionV2`;
- `canonicalContentRepository`;
- `realtimeGatewayV2`;
- `legacyStoreReadOnly`;
- `generatedContracts`.

Use dual-read comparison only temporarily and never allow two writers to diverge. If dual-write is unavoidable, define reconciliation and a short removal deadline.

---

## 24. Conflicts and interactions

### Phase 1 security

Phase 2 must preserve fail-closed identity and server authority. Refactoring cannot reintroduce whole-profile writes or payload identity.

### Phase 3 learning UX

Phase 3 depends on stable plan/lesson/practice/progress contracts. Do not overfit schemas to current screen mockups; model learning concepts independently.

### Phase 4 content workflow

Content tables must support draft/revision/publication states, but Phase 2 should not implement the full Studio prematurely.

### Phase 5 social/realtime

Define stable IDs, server time and event envelopes now. Avoid implementing full community feeds before moderation/privacy design.

### Phase 6 economy

Wallet/entitlement foundations are established, but catalog/pricing/payment provider choices wait.

### Offline conflict

Do not promise arbitrary offline mutation in Phase 2. Define reconciliation capability; Phase 7 decides supported offline flows.

### Motion conflict

Persist consumed authoritative event IDs or equivalent so UI can avoid duplicate celebrations after reload/reconnect.

---

## 25. Forbidden shortcuts

- moving files without defining ownership;
- creating ten packages because the project “looks cleaner”;
- using database rows directly as public API responses;
- sharing frontend types as unvalidated server contracts;
- dual-writing indefinitely;
- keeping both static and SQL question repositories as equal production truth;
- adding a queue without job idempotency/checkpointing;
- using mutable names as relational keys;
- returning full question banks to the client;
- storing all domains in one profile JSON column because it is convenient;
- declaring architecture complete without migration and dependency tests.

---

## 26. Acceptance criteria

Phase 2 is complete when:

1. Domain ownership is documented and reflected in code boundaries.
2. Authentication/authorization from Phase 1 remains enforced across HTTP and realtime.
3. Canonical versioned runtime schemas exist for core API/events/entities.
4. Frontend consumes typed validated API contracts.
5. Whole-profile authoritative writes are gone.
6. Core production persistence uses transactional repositories.
7. JSON is limited to approved dev/import/export/static snapshot roles.
8. One canonical published content repository serves learning and game consumers.
9. Profile, progression, wallet and entitlement are separate authoritative domains.
10. App/server creation is testable without binding a network port.
11. Socket.IO has typed event envelopes, server time and sequence/reconnect foundations.
12. Bot uses backend services rather than duplicate business logic.
13. Migrations are versioned, rehearsed and observable.
14. Dependency/architecture tests block forbidden imports and cycles.
15. API/error/pagination/idempotency conventions are consistent.
16. Deployment units and environment configuration are documented accurately.
17. Phase 3 can build Today/Lessons/Practice without inventing another data model.

### 26.1 Definition of Done — sign-off (WS5, 2026-09-09)

`npm run check` green — **342 tests**, `lint:ws` + `typecheck` ×2 + `smoke-audit`
+ `build`. WS1–WS4 merged (`b4d0a34` / `009c5a2` / `1ca59bd` / `f25eca5`); WS5 on
`phase-2/ws5-jobs-storage-deploy`.

| # | Status | Evidence |
|---|--------|----------|
| 1 | ✅ met | `server/domains/README.md` map; `contracts/__tests__/architecture.test.ts`, `server/__tests__/architecture.test.ts` |
| 2 | ✅ met | Phase 1 auth unchanged; `auth.test.ts`, `socket.test.ts`, `rbac.test.ts` still green |
| 3 | ✅ met | `contracts/` (WS1), `CONTRACT_VERSION` + `x-contract-version` header |
| 4 | ✅ met | `src/lib/apiClient` validates every response against a Zod contract (WS4) |
| 5 | ✅ met | no client whole-profile write since Phase 1 WS4; only the preference whitelist (`me.ts`) |
| 6 | 🟡 partial | wallet ledger + identity/RBAC + content on transactional Drizzle repos; **progression/stats still on the `dbStore` blob** — decomposition is the §18.2 rollout follow-up |
| 7 | 🟡 partial | JSON is the dev default + import/snapshot format; **`STORAGE_PROVIDER=json` is still a production-capable profile/stats store** — retired with the progression decomposition (§27 step 8) |
| 8 | ✅ met | `question_revisions` + `CANONICAL_CONTENT_REPOSITORY` cutover (WS3); `content.test.ts` |
| 9 | 🟡 partial | wallet ✅ (ledger), preferences ✅ (typed `user_preferences`, WS5 part 5); **progression + entitlement still in the blob** — same follow-up |
| 10 | ✅ met | `createHttpServer` builds the full stack with no `listen`; `architecture.test.ts` "composition root" |
| 11 | ✅ met | `RealtimeEvent` envelope + per-room sequence + `resync_room` behind `REALTIME_GATEWAY_V2` (WS3); `realtimeGateway.test.ts` |
| 12 | ✅ met | `bot/README.md` + architecture test pins `bot/` imports no `server/` runtime module (WS3) |
| 13 | ✅ met | Drizzle Kit journal/checksum/ordered ids; `db:migrate` + `drizzle.__migration_runs`; `migrate.test.ts`; `docs/DEPLOYMENT.md` §4.2 |
| 14 | ✅ met | `architecture.test.ts` (contracts purity, frontend↛server, domain boundary, port-free build), `schemaParity.test.ts` |
| 15 | ✅ met | §7.5 error envelope, `idempotencyKey` on commands, `validateBody`; `contracts.test.ts` |
| 16 | ✅ met | `docs/DEPLOYMENT.md` (7 units + per-unit env), `docs/OBSERVABILITY.md`, `.env.example` (WS5 parts 3–4) |
| 17 | ✅ met | published content query + versioned sets + typed progression outcomes + preference schema are all in place for Phase 3 |

**14 / 17 fully met.** #6, #7, #9 share one remaining piece: decomposing the
`player_profiles` / `player_stats` progression + entitlement fields into typed
transactional tables and retiring `STORAGE_PROVIDER=json` for them. WS5 landed
the framework for this (typed `user_preferences` cutover, `LEGACY_STORE_READONLY`,
the backfill-script pattern) and preferences are done; progression/entitlement
decomposition is a bounded, well-specified rollout task (see §18.2 remaining work
+ [ROLLOUT_PHASE_2.md](../ROLLOUT_PHASE_2.md)). It is intentionally **not** rushed
into WS5 — it touches the reward/celebration hot path and wants its own change +
rollout evidence (§27 step 9).

---

## 27. Rollout and rollback

Rollout:

1. deploy schemas/migrations;
2. enable new repositories in shadow/read comparison;
3. compare projections;
4. migrate internal users/content;
5. release API v1 client;
6. switch reads;
7. switch writes;
8. make legacy stores read-only;
9. remove compatibility after retention window.

Rollback:

- preserve new events/ledger/audit;
- switch read projection only if data remains consistent;
- do not restore insecure client writes;
- retain migration markers;
- use forward-fix for already consumed irreversible events;
- keep old content snapshot available until new repository validation completes.

---

## 28. Handoff to Phase 3

Phase 3 receives:

- stable authenticated frontend session;
- Today/plan/lesson/practice/progress API foundations;
- canonical user/profile projection;
- authoritative progression outcomes with event IDs;
- theme/accessibility/motion preferences schema;
- published content query interface;
- versioned cacheable content sets;
- standard loading/error/offline contracts;
- safe feature flag and analytics infrastructure.

Phase 3 must use these contracts instead of recreating progression or content logic in UI components.
