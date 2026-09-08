# ADR-012 spike findings — Drizzle ORM + Drizzle Kit

**Branch:** `phase-2/ws2-persistence` · **Date:** 2026-09-07 · **Status:** complete — **Drizzle confirmed**

Owner pre-approved Drizzle + Drizzle Kit on 2026-09-07; this spike confirms the
pick and fills in ADR-012's "деталі й наслідки" before WS2 writes the real
`server/infrastructure/database/` layer.

Versions exercised (installed `--no-save` for the spike):

| Package | Version | Add as |
|---|---|---|
| `drizzle-orm` | `0.44.7` | `dependencies` |
| `drizzle-kit` | `0.31.10` | `devDependencies` |
| `pg` | `8.21.0` (already present) | keep — Drizzle wraps the existing `Pool` |

---

## 1. Does Drizzle coexist with the raw `pg` Pool? — ✅ yes

`server/db/pgPool.ts` lazily builds a single `pg.Pool`. Drizzle's
`drizzle-orm/node-postgres` adapter takes that same `Pool` instance
(`drizzle(pool, { schema })`), so:

- the lazy-import / `isDatabaseConfigured()` gate is untouched;
- raw `queryRows()` and Drizzle queries share one connection pool;
- migration adoption can be incremental — a table moves to a repository without
  forcing the rest off raw SQL.

## 2. Migration framework vs §18.1 checklist — ✅ covers 7/9, 2 are runbook items

| §18.1 requirement | Drizzle Kit |
|---|---|
| ordered migration IDs | ✅ `0000_`, `0001_` … prefix |
| migration journal | ✅ `migrations/meta/_journal.json` |
| checksum | ✅ per-snapshot hash in `meta/` |
| transaction where supported | ✅ statements wrapped per-migration (PG DDL is transactional) |
| status + timing | ⚠️ `__drizzle_migrations` table records applied-at; no duration column — add a wrapper |
| safe rerun policy | ✅ journal-guarded; re-running is a no-op |
| staging rehearsal | ✅ `drizzle-kit migrate` against a staging URL; `--dry-run` for the plan |
| backup/restore steps | ❌ out of scope for the tool — runbook item (§18.1, WS5 deploy doc) |
| forward-fix for irreversible changes | ❌ policy, not tooling — documented in the migration runbook |

Generated migration from `schema.ts` with **no DB connection**:
`./migrations/0000_clammy_owl.sql` (8 tables, 5 FKs, 5 indexes incl. the partial
`WHERE revoked_at is null`) + `meta/_journal.json` (journal v7) +
`meta/0000_snapshot.json` (the checksummed snapshot). The generated DDL for the
carried-over `wallet_ledger` / `migration_records` is column-identical to the
hand-written `server/db/schema.sql` — a first migration can `CREATE TABLE IF NOT
EXISTS` / adopt without a data move.

## 3. Contract composition — the §25 risk

See [`./contract-bridge.ts`](./contract-bridge.ts).

**Recommendation:** `@contracts` (Zod) stays the single source for every process/
network boundary shape. Drizzle's `InferSelectModel` types are *storage* shapes,
internal to `server/infrastructure/`. The repository is the mapping seam:

- a `jsonb` column that holds a contract type is declared `.$type<TheContractType>()`
  so storage and boundary agree at compile time, **and** the repository
  `schema.parse()`es it on read — DB bytes are a trust boundary like any input (§8);
- `drizzle-zod` may be used for internal insert guards but its output is **never**
  re-exported from `contracts/` (the purity + parity tests would not catch this —
  add a lint rule in WS2);
- domain repository *interfaces* expose only domain / `@contracts` types, never
  `InferSelectModel` — verified in `./repositories.ts`.

## 4. `Transaction` handle → `ServiceContext.tx`

`server/domains/shared/context.ts` already reserves an opaque
`Transaction` slot. Drizzle's `db.transaction(async (tx) => …)` callback param is
that handle. WS2 concretises `Transaction` as
`Parameters<Parameters<Db['transaction']>[0]>[0]` (see `./repositories.ts`) and
threads it through `ServiceContext`. Repos that receive no `tx` read on the pool.

## 5. Toolchain fit — ✅ clean

- TS `~6.0.2`, `moduleResolution: bundler`, ESM (`"type": "module"`): the spike
  type-checks with `strict` (`spike/drizzle/tsconfig.json`, `tsc` exit 0),
  including `InferSelectModel` composition against `@contracts`.
- `drizzle-kit` runs `drizzle.config.ts` (a `.ts` file) directly — no build step.
- `npm run check` (lint:ws + typecheck + typecheck:server + 167 tests +
  smoke-audit + build) stays green with `drizzle-orm@0.44.7` present.
- **Lockfile:** installed `--no-save` for the spike → `package.json` /
  `package-lock.json` untouched (verified `git status` clean). The install did
  prune 129 *extraneous* (not-in-lockfile) packages from `node_modules`; `npm ci`
  restores them and `npm run check` is unaffected. For the real WS2 commit, add
  `drizzle-orm` to `dependencies` + `drizzle-kit` to `devDependencies` via
  `npm install --package-lock-only` then hand-trim the diff — same technique WS1
  used for `zod` (see [[phase-1-workstreams]]).

## 6. Open decisions for ADR-012 body

- [ ] snapshot-as-jsonb vs fully decomposed progression columns (spike uses jsonb;
      §9 allows "event-derived state" — WS2 picks per domain)
- [ ] one schema file vs per-domain schema files re-exported (lean per-domain,
      matches `server/domains/` ownership)
- [ ] `drizzle-kit push` allowed in dev only; staging/prod are `migrate` only
- [ ] custom `status + timing` wrapper around `__drizzle_migrations`

## 7. Verdict — adopt Drizzle + Drizzle Kit (ADR-012 → accepted)

Nothing in the spike argues against the pre-approved pick:

- wraps the existing `pg.Pool`, so adoption is incremental and the raw-SQL
  question-bank path is untouched until WS3;
- `drizzle-kit generate` gives ordered IDs + journal + checksum offline — 7 of
  the 9 §18.1 properties for free; the other 2 (backup/restore, forward-fix
  policy) are runbook items regardless of tool;
- inferred types compose with `@contracts` **as storage types behind the
  repository seam** — the §25 trap is avoided by rule, not by luck (add the
  "no drizzle-zod re-export from contracts/" lint in WS2);
- `Transaction` handle already has a home in `ServiceContext`.

**WS2 build order (unchanged from the phase-2 memo):** migration framework +
adopt existing tables → new identity/RBAC tables → repository interfaces +
contract tests (SQL ↔ in-memory parity) → persisted role store w/ runtime
grant/revoke → shared rate-limit/metrics store. Flag `legacyStoreReadOnly`.
