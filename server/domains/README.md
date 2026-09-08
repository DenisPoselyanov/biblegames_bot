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

## Populated so far (WS2)

- **`identity/`** — `repository.ts` (`UserRepository`, `RoleRepository`),
  `types.ts`, `inMemoryRepository.ts`. SQL adapter:
  `server/infrastructure/database/repositories/identity.ts`. Contract:
  `identity/__tests__/repositoryContract.ts` (runs vs in-memory + pglite).

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
