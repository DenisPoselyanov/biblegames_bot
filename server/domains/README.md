# `server/domains/` — domain ownership map (Phase 2 §5)

Each subdirectory owns one bounded slice of the product. WS1 establishes the
**boundaries and the rules**; WS2/WS3 move the existing logic (`server/auth`,
`server/authz`, `server/wallet`, `server/progression`, `server/services`,
`server/roomManager`, question loaders …) into these modules behind repository
and service interfaces. Files are NOT relocated before their ownership and
contract tests exist (§25 "moving files without defining ownership").

## Rules (enforced by `contracts/__tests__/architecture.test.ts`)

- A domain module must not import `express`, `socket.io`, `react`, a route file,
  or a page. It receives a `ServiceContext` (`./shared/context.ts`) — principal,
  request id, clock, and later a transaction handle — never a `Request`.
- A domain owns its types, runtime schemas (from `@contracts` where client-facing),
  service commands, repository *interfaces*, and tests. Infrastructure adapters
  (SQL / in-memory) implement those interfaces from `server/infrastructure/`
  (WS2). Interfaces expose domain / `@contracts` types only — never a Drizzle
  `InferSelectModel` or a `pg` type. The opaque `Transaction` from
  `ServiceContext` is narrowed to a driver type only inside the SQL adapter.
- No cycles between domains. Cross-domain needs go through a published service
  interface, not a deep import.

## Populated so far

- **`identity/`** (WS2) — `repository.ts` (`UserRepository`, `RoleRepository`),
  `types.ts`, `inMemoryRepository.ts`. SQL adapter:
  `server/infrastructure/database/repositories/identity.ts`. Contract:
  `identity/__tests__/repositoryContract.ts` (runs vs in-memory + pglite).
- **`content/`** (WS3 part 1, §14) — `repository.ts`
  (`QuestionRevisionRepository`, `ContentSetRepository`), `types.ts`,
  `contentHash.ts` (stable sha-256 body/set hashing), `inMemoryRepository.ts`.
  SQL adapter: `server/infrastructure/database/repositories/content.ts`.
  Contract: `content/__tests__/repositoryContract.ts`. Read contract in
  `@contracts` `schemas/content.ts`. The legacy `questions` bank stays
  authoritative until the `canonicalContentRepository` cutover (part 3).
- **`progression/`** (WS6, §18.2, ADR-016) — `repository.ts`
  (`ProgressionStateRepository` with `FOR UPDATE`, `AchievementRepository`,
  `ThemeStatsRepository`, `AnswerHistoryRepository`), `types.ts`,
  `mapSnapshot.ts` (storage ↔ reward-engine `ProgressionSnapshot`),
  `inMemoryRepository.ts`. SQL adapter:
  `server/infrastructure/database/repositories/progression.ts`. Contract:
  `progression/__tests__/repositoryContract.ts` (in-memory + pglite). Tables:
  `progression_state` / `achievement_grants` / `player_theme_stats`.
- **`economy/`** (WS6, §18.2, ADR-016) — `entitlements.ts`
  (`EntitlementRepository`), `types.ts`, `inMemoryRepository.ts`. SQL adapter:
  `server/infrastructure/database/repositories/economy.ts`. Table:
  `entitlements`. `wallet_ledger` keeps its home under `server/wallet/`
  (predates this layout).
- **`learning/`** (Phase 3 WS1, ADR-017) — `repository.ts` (`LearningPlanRepository`,
  `LearningModuleRepository`, `LearningObjectiveRepository`, `LessonRepository`,
  `LessonBlockRepository`), `types.ts` (incl. `LESSON_BLOCK_TYPES`, §11.3),
  `inMemoryRepository.ts`. SQL adapter:
  `server/infrastructure/database/repositories/learning.ts`. Contract:
  `learning/__tests__/repositoryContract.ts` (in-memory + pglite). Tables:
  `learning_plans` / `learning_modules` (self-referencing `parentModuleId`) /
  `learning_objectives` / `lessons` / `lesson_blocks`. Populated by
  `scripts/migrate/map-learning-content.ts` from `data/topics-db/*.json`
  (`source = 'topic-tree'`); rows land `legacy_unreviewed`, never `published` —
  WS2 builds the read API and the promotion policy. Does not own question
  publication (stays in `content`); does not yet own practice/review sessions or
  answer attempts (still `progression`/`me.ts` — moving that is WS2 scope per the
  ownership map below).

## Map

| Domain | Owns (§5) | Does **not** own |
|---|---|---|
| `identity` | authenticated principal, Telegram mapping, account status, roles/permissions, sessions, privacy requests | profile cosmetics, progression, group membership |
| `learning` | plans, modules, lessons, objectives, practice/review sessions, answer attempts, mastery inputs | question publication lifecycle (consumes Content) |
| `progression` | XP/wisdom, levels, ranks, streak, achievements, reward eligibility, progression outcomes | payments, catalog definitions |
| `economy` | wallet, ledger, transaction/reversal, entitlements, purchase outcomes | learning completion rules |
| `content` | canonical question/lesson schemas, published revisions, topic hierarchy, Scripture references | user answer history |
| `social` | communities, membership, friend/challenge relationships, leaderboards, moderation policy | (impl. deferred to Phase 5; IDs defined now) |
| `realtime` | room/session transport, server-time sync, reconnect tokens, event sequencing, broadcast delivery | authoritative game scoring (stays in game/domain services) |
| `shared` | `ServiceContext`, cross-domain value types, result/error helpers | anything domain-specific |
