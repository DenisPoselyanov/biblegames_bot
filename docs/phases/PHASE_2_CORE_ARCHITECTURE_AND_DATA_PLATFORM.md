# Phase 2 — Core Architecture & Authoritative Data Platform

> **Priority:** P0/P1 foundation  
> **Depends on:** Phase 1 secure identity, authorization, authoritative mutations and green engineering gates  
> **Blocks:** full learning rebuild, reviewed content platform, social persistence, economy and release hardening  
> **Canonical parent:** [`../BIBLE_GAMES_MASTER_SPECIFICATION.md`](../BIBLE_GAMES_MASTER_SPECIFICATION.md)

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
