# Phase 1 — Production Safety & Engineering Foundation

> **Priority:** P0 release blocker  
> **Depends on:** Phase 0 verified baseline  
> **Blocks:** Phase 2–8 production implementation  
> **Canonical parent:** [`../BIBLE_GAMES_MASTER_SPECIFICATION.md`](../BIBLE_GAMES_MASTER_SPECIFICATION.md)

---

## 1. Product outcome

After Phase 1, Bible Games is no longer a client-trusted prototype. A real user cannot impersonate another Telegram user, self-award coins or ranks, call an admin mutation without permission, duplicate rewards through retries, or silently run the server in an unsafe production configuration.

The phase does not redesign the product. It establishes the safety and engineering baseline required for every later phase.

---

## 2. Verified baseline and critical conflicts

### Current identity flow

`server/middleware/telegramAuth.ts` currently:

- requires `x-user-id`;
- verifies Telegram `initData` only when both a bot token and header are present;
- falls back to trusting `x-user-id` when strict conditions are not met;
- does not bind a typed authenticated principal to the request;
- does not enforce `auth_date` freshness;
- compares the HMAC as a normal string rather than a timing-safe buffer comparison.

`server/index.ts` then compares the route `:userId` to the same client-controlled `x-user-id`. This does not create authorization because the client controls both values.

### Current progression/economy flow

`src/context/PlayerContext.tsx` calculates and persists:

- coins;
- theme points;
- completed levels;
- practice tracks;
- streak;
- achievements;
- player rank and wisdom;
- theme/avatar purchases;
- Millionaire/Survival outcomes.

`server/middleware/validateBody.ts` sanitizes shape and ranges but still accepts these final values from the client. Sanitization is not authorization or server authority.

### Current server composition

`server/index.ts` mixes:

- protected profile/stats routes;
- public question/scripture routes;
- admin question routes;
- demo/in-memory study and dashboard endpoints;
- hardcoded leaderboard data;
- Kahoot HTTP and Socket.IO lifecycle;
- server startup configuration.

This makes security boundaries difficult to audit.

### Current engineering gates

The root package has build and lint scripts, but no canonical `typecheck`, `typecheck:server`, general test runner, integration suite or single blocking `check` command. Production deployment can therefore pass while server or security behavior remains broken.

---

## 3. Non-negotiable architecture decisions

1. Production authentication is fail-closed.
2. Identity is derived from verified Telegram `initData` or a server session created from it.
3. Request body, route params, query params and `x-user-id` never establish identity.
4. Authorization is server-side and explicit for every protected operation.
5. Progression, wallet, rewards, purchases, ranks, achievements and competitive outcomes are server-authoritative.
6. Mutations are idempotent where retries can occur.
7. Production data uses transactional persistence.
8. Demo and development fallbacks are impossible to enable accidentally in production.
9. CI blocks merge/deploy when required checks fail.
10. Phase 1 changes use feature flags and migration paths rather than a destructive all-at-once switch.

---

## 4. Target module boundaries

The exact file names may be adjusted after the execution audit, but the responsibilities must be separated.

```text
server/
├── config/
│   ├── env.ts
│   └── productionValidation.ts
├── auth/
│   ├── telegramInitData.ts
│   ├── principal.ts
│   ├── middleware.ts
│   ├── devIdentityProvider.ts
│   └── policies.ts
├── domains/
│   ├── profile/
│   ├── progression/
│   ├── economy/
│   ├── achievements/
│   └── audit/
├── middleware/
│   ├── asyncHandler.ts
│   ├── rateLimit.ts
│   ├── requestId.ts
│   └── errorHandler.ts
├── routes/
│   ├── profile.ts
│   ├── progression.ts
│   ├── economy.ts
│   ├── admin.ts
│   └── health.ts
└── index.ts
```

This is a logical separation, not a monorepo rewrite. Existing files may be migrated incrementally.

---

## 5. Authentication implementation

## 5.1 Environment validation

Create a typed server configuration module that validates environment variables before the server listens.

Production must refuse to start when:

- `TELEGRAM_BOT_TOKEN` is missing;
- production auth mode is not explicitly secure;
- database configuration required for production is missing;
- dev identity mode is enabled;
- public origin configuration is invalid;
- encryption/session secrets are missing when server sessions are used.

Avoid reading environment variables in many modules at import time. Parse once and inject typed config.

## 5.2 Telegram initData verification

Implement a dedicated verifier:

- parse URL-encoded fields;
- require `hash`;
- build the sorted data check string exactly once;
- derive the secret key according to Telegram Web App rules;
- compare binary values with `crypto.timingSafeEqual`;
- parse `user` safely;
- validate user ID and required fields;
- enforce `auth_date` maximum age;
- reject malformed JSON, duplicate keys and unexpected values according to policy;
- return a typed verified principal, not `{ ok: boolean }` only.

Target principal:

```ts
interface AuthenticatedPrincipal {
  userId: string;
  telegramUserId: string;
  displayName: string;
  username?: string;
  languageCode?: string;
  authenticatedAt: string;
  authSource: 'telegram';
}
```

Do not put the full raw initData or unnecessary Telegram profile fields into application logs.

## 5.3 Request authentication middleware

Middleware must:

- read initData from the agreed header or authorization format;
- verify it;
- attach `req.auth`;
- return stable error codes for missing, expired and invalid credentials;
- never fall back to `x-user-id` in production;
- not require user ID route params for self-scoped routes.

Prefer self-scoped endpoints:

```text
GET /api/v1/me/profile
PATCH /api/v1/me/preferences
POST /api/v1/practice/sessions/:id/answers
```

When admin/leader operations target another user, authorization must use policy checks rather than comparing headers.

## 5.4 Development identity

A development identity provider may exist only when:

- `NODE_ENV !== 'production'`;
- an explicit `AUTH_MODE=development` is set;
- the server prints a visible warning;
- test identities are deterministic fixtures;
- CI includes a test proving production rejects the mode.

The provider should attach the same principal shape so domain code does not contain separate insecure branches.

## 5.5 Session option

A server session bridge may be introduced to reduce repeated initData validation, but only if:

- session creation requires valid initData;
- sessions are signed and expire;
- revocation and rotation are defined;
- CSRF/cookie settings match the deployment model;
- Telegram WebView compatibility is tested;
- raw initData remains sufficient as a fallback during migration.

Do not add sessions merely to hide an insecure client header.

---

## 6. Authorization and RBAC

## 6.1 Roles and permissions

Define server-side roles such as:

- `user`;
- `group_leader`;
- `content_reviewer`;
- `content_publisher`;
- `support`;
- `admin`.

Define permissions independently where appropriate:

- read own profile;
- update own preferences;
- create content draft;
- review content;
- publish content;
- manage users/groups;
- view audit logs;
- operate Kahoot host features;
- export session data.

Never use frontend `VITE_ADMIN_IDS` as the authority. It may hide a menu for UX only.

## 6.2 Policy middleware

Create reusable policies:

```text
requireAuthenticated
requireRole
requirePermission
requireOwnResourceOrPermission
requireRoomHost
```

Policies should produce stable 401/403 responses and structured audit context.

## 6.3 Admin route isolation

`/api/admin/questions` must not become safe merely because `QUESTION_ADMIN_ENABLED=true`.

Required changes:

- authenticate before route mounting;
- authorize specific permissions;
- rate limit;
- audit every mutation;
- reject direct production file writes;
- optionally disable the entire route in user-facing deployment until Phase 4 Content Studio exists;
- ensure public frontend bundles do not expose functional admin secrets.

## 6.4 Audit log

Audit critical actions:

- role changes;
- admin/content mutations;
- wallet adjustments;
- migration claims;
- purchase reversals;
- account deletion/export requests;
- security-sensitive configuration failures.

Audit records include actor, action, target, timestamp, request ID, result and safe metadata. They must not contain secrets or raw private payloads.

---

## 7. Server-authoritative progression

## 7.1 Replace whole-profile writes

The current `PUT /profile/:userId` accepts an entire profile. Replace it with bounded commands and preference updates.

Allowed preference updates may include:

- display name within policy;
- Bible translation;
- active owned theme;
- avatar selection;
- accessibility/motion settings;
- notification preferences.

Not accepted from the client as final truth:

- coins;
- XP/wisdom;
- rank;
- streak;
- achievements;
- completed levels;
- mastery;
- practice unlocks;
- game wins;
- entitlements.

## 7.2 Commands and outcomes

Introduce command endpoints such as:

```text
POST /api/v1/practice/sessions
POST /api/v1/practice/sessions/:sessionId/answers
POST /api/v1/practice/sessions/:sessionId/complete
POST /api/v1/lessons/:lessonId/complete
POST /api/v1/games/millionaire/:runId/complete
POST /api/v1/games/survival/:runId/complete
POST /api/v1/shop/purchases
```

The server validates session/run state and returns a typed outcome:

```ts
interface ProgressionOutcome {
  eventId: string;
  previous: ProgressionSnapshot;
  next: ProgressionSnapshot;
  delta: {
    coins?: number;
    xp?: number;
    wisdom?: number;
    levelChanged?: boolean;
    rankChanged?: boolean;
    achievementsGranted?: string[];
  };
  occurredAt: string;
}
```

The final contract is refined in Phase 2, but Phase 1 must stop trusting client totals.

## 7.3 Reward idempotency

Each mutation that can be retried requires:

- an idempotency key;
- a unique command/session identity;
- a database uniqueness constraint or transactional check;
- cached/recorded previous result for safe replay;
- tests for rapid double submit, network retry and server restart.

A second identical completion may return the original result but must not add another reward or emit another celebration-worthy event.

## 7.4 Streak and timezone

Streak is server-calculated using:

- an explicit user timezone or Telegram-derived/default policy;
- canonical day boundaries;
- idempotent daily completion records;
- no trust in client clock;
- explicit handling for timezone change and delayed offline events.

The detailed learning model belongs to Phase 2/3, but Phase 1 must prevent arbitrary streak writes.

## 7.5 Achievements and ranks

Achievement and rank grants are derived from authoritative events. The client may display a returned grant but cannot request an arbitrary achievement ID or rank value.

Stable event IDs are required because Phase 3 motion must not replay a level/rank animation after reconnect or remount.

---

## 8. Economy safety foundation

Phase 6 owns the full shop, but Phase 1 establishes safe primitives:

- wallet account per user;
- immutable ledger entries;
- transaction type enum;
- balance derived or transactionally maintained;
- unique source/event ID;
- no negative balance unless an explicit debt policy exists;
- adjustment permission and audit;
- reversal link to original transaction;
- no direct `coins` update in profile payload.

Legacy `coins + totalPoints` migration must be bounded and recorded, not repeatedly added on each save.

---

## 9. Legacy profile migration

## 9.1 Migration record

Create a migration table/record containing:

- user ID;
- source version;
- migration version;
- submitted hash;
- accepted bounded values;
- rejected/suspicious values;
- created wallet opening entry;
- timestamp;
- status;
- operator/review state if manual review is required.

## 9.2 Trust policy

Legacy values were client-controlled. Therefore:

- preferences may be accepted after schema validation;
- progress may be imported with bounds and provenance;
- very large coins/ranks cannot be blindly trusted;
- entitlements should be reconciled against known catalog/history where possible;
- suspicious values are quarantined or capped according to an explicit owner-approved policy;
- migration is one-time and idempotent.

## 9.3 Compatibility window

During rollout:

- old client may operate read-only or receive an upgrade-required response for unsafe mutations;
- new endpoints run behind a feature flag;
- the server can read legacy profiles but writes canonical structures;
- rollback does not restore insecure writes.

---

## 10. Server and route refactor

Break `server/index.ts` into composition modules while preserving behavior:

- app creation separate from `listen` for integration tests;
- health/readiness routes;
- public content routes;
- authenticated self routes;
- admin routes;
- realtime initialization;
- centralized error handling;
- dependency injection for stores/config.

This refactor must not silently change game logic. First add tests around existing behavior, then move code.

### Demo endpoints

`/study/path`, `/study/answer`, `/daily/complete`, `/dashboard`, `/leaderboard` must be:

- removed from production;
- or mounted only under an explicit development/demo router;
- or replaced with honest authenticated APIs.

Hardcoded players must never appear in production ranking.

---

## 11. Socket.IO security

Current room creation/join events accept names and Telegram IDs from payloads. Required Phase 1 safety work:

- authenticate socket handshake with verified initData/session;
- attach principal to socket data;
- ignore payload-provided identity for authenticated actions;
- authorize host-only events;
- rate limit joins, answers and room creation;
- validate payload schemas;
- bind reconnect token/session safely;
- avoid using mutable player names as identity;
- produce request/event IDs for audit and replay handling;
- clean up rooms and disconnected sockets predictably.

Phase 5 owns full multiplayer persistence and product behavior; Phase 1 only establishes secure identity and permission boundaries.

---

## 12. Validation and error contracts

Replace ad hoc sanitization with boundary schemas using a chosen validation library or explicit typed validators.

Requirements:

- reject invalid critical input instead of silently coercing it;
- stable machine-readable error code;
- user-safe message key;
- request ID;
- field errors where relevant;
- no stack trace or secrets in client responses;
- consistent 400/401/403/404/409/422/429/500 semantics.

Do not silently convert an invalid difficulty, rank or answer into a default that changes business outcomes.

---

## 13. Rate limiting and abuse controls

Apply different policies to:

- auth attempts;
- profile/preferences;
- practice answer submission;
- room creation/join;
- admin/content mutation;
- telemetry;
- exports;
- future payment endpoints.

Use user ID plus IP/device signals carefully. Rate limits must not expose private data or permanently lock legitimate shared-network users.

---

## 14. Engineering gates

Add canonical scripts:

```json
{
  "typecheck": "tsc -b --pretty false",
  "typecheck:server": "...",
  "test": "...",
  "test:integration": "...",
  "check": "npm run lint && npm run typecheck && npm run typecheck:server && npm run test && npm run test:integration && npm run smoke-audit && npm run build"
}
```

The exact runner may be Vitest/Node test/etc., but one standard must be chosen.

CI stages:

1. install with lockfile;
2. lint;
3. frontend typecheck;
4. server typecheck;
5. unit tests;
6. integration/security tests;
7. smoke/content checks appropriate for Phase 1;
8. build;
9. deploy only from successful protected workflow.

No `continue-on-error` for required gates.

---

## 15. Required tests

## Authentication

- valid initData accepted;
- invalid hash rejected;
- missing hash rejected;
- expired auth_date rejected;
- forged user payload rejected;
- missing token/config blocks production startup;
- `x-user-id` cannot authenticate;
- dev auth impossible in production;
- timing-safe comparison path covered.

## Authorization

- normal user cannot call admin mutation;
- content reviewer cannot publish without permission;
- cross-user profile access rejected;
- hidden frontend route does not grant access;
- Socket.IO non-host cannot start/advance room.

## Progression/economy

- client cannot PUT coins/rank/achievements;
- duplicate completion grants once;
- concurrent duplicate requests grant once;
- failed transaction grants nothing;
- retry returns the original outcome;
- migration runs once;
- suspicious legacy value follows policy;
- achievement/rank event is not duplicated.

## Data and reliability

- JSON dev adapter writes atomically;
- SQL transaction rolls back on failure;
- server app can be instantiated without listening;
- readiness fails when database unavailable;
- error responses include request ID and no secrets.

---

## 16. Observability

Add:

- structured logs;
- request IDs propagated through HTTP and Socket.IO;
- auth failure counters without logging credentials;
- mutation/reward failure metrics;
- idempotency collision/replay metrics;
- readiness/liveness endpoints;
- safe audit queries;
- startup configuration summary without secrets.

Do not log raw Telegram initData, full profiles, payment data or Scripture/AI payloads unnecessarily.

---

## 17. Feature flags and rollout

Suggested flags:

- `authV2`;
- `authoritativeProfileV2`;
- `walletLedgerV1`;
- `secureKahootIdentity`;
- `disableLegacyProfileWrites`;
- `demoRoutesEnabled` restricted to non-production.

Rollout order:

1. deploy schema and read-compatible server;
2. enable logging-only validation where safe;
3. release compatible client;
4. migrate internal test users;
5. enable authoritative writes for internal users;
6. closed alpha percentage rollout;
7. disable legacy writes;
8. remove temporary compatibility after evidence.

Every flag has owner, default, environment restrictions, telemetry and removal date.

---

## 18. Conflicts with later phases

### Phase 2 conflict: premature abstraction

Do not build an elaborate domain framework before the immediate security boundary is fixed. Phase 1 may introduce minimal services/contracts; Phase 2 consolidates them.

### Phase 3 conflict: redesign touching identity/profile

Phase 3 UI must consume the new profile/outcome APIs. Do not implement a second client profile store that restores whole-profile writes.

### Phase 4 conflict: admin/content tools

Admin question mutation should be disabled or minimally protected now. Full editorial lifecycle waits for Phase 4.

### Phase 5 conflict: Kahoot product rewrite

Secure socket identity and host authorization now; do not expand social features before persistence and contracts are ready.

### Phase 6 conflict: shop

Create wallet safety primitives only. Do not finalize catalog, Stars or pricing before owner decisions and Phase 6.

### Motion conflict

Server outcomes must contain stable event IDs so Phase 3/5/6 animations do not replay. Phase 1 does not implement celebration UI.

---

## 19. Forbidden shortcuts

- keeping `x-user-id` as a hidden fallback;
- trusting the client because the app runs inside Telegram;
- validating ranges but still accepting final coins/rank;
- protecting admin only with a frontend check or environment flag;
- storing production wallet as one mutable integer without ledger/audit;
- adding a database without transactions or migration tests;
- disabling tests to make CI green;
- combining this phase with the full rebrand;
- optimistic reward/purchase/win animation before server confirmation;
- marking Phase 1 complete while demo endpoints remain indistinguishable from production.

---

## 20. Definition of Done

Phase 1 is complete only when:

1. Production starts only with valid secure configuration.
2. Valid Telegram identity is the only production user identity source.
3. `x-user-id` cannot authenticate or authorize.
4. All protected HTTP and Socket.IO operations use a typed principal.
5. Admin/content mutations require server permissions and produce audit records.
6. The client cannot write coins, rank, streak, achievements, mastery, unlocks or game wins as final values.
7. Reward and progression commands are transactional and idempotent.
8. Stable authoritative event IDs exist for future motion/notifications.
9. Legacy profile migration is bounded, versioned and one-time.
10. Demo routes are removed from production or explicitly isolated.
11. CI runs lint, frontend/server typecheck, unit/integration tests, smoke checks and build.
12. Security tests cover forged identity, cross-user access, duplicate mutation and rollback.
13. Production persistence is transactional.
14. Feature flags and rollback are documented and tested.
15. No critical P0 issue from the Phase 0 audit remains open without an explicit accepted exception.

---

## 21. Rollback

Rollback may disable new client use or temporarily switch traffic, but it may not re-enable insecure production identity or whole-profile authority.

Required rollback assets:

- database migration rollback or forward-fix plan;
- old-client compatibility response;
- feature flag to stop new authoritative mutations safely;
- preserved ledger/audit records;
- documented incident steps;
- no destructive deletion of legacy data until migration validation is complete.

---

## 22. Handoff to Phase 2

Phase 2 receives:

- typed authenticated principal;
- working policy middleware;
- secure self-scoped APIs;
- minimal progression/economy command services;
- authoritative event IDs;
- transactional store baseline;
- standard error envelope;
- green engineering gates;
- migration and audit mechanisms.

Phase 2 then consolidates these into stable domain boundaries, canonical schemas and deployment architecture without reopening client-trust vulnerabilities.
