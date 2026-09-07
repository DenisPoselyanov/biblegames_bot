# `server/infrastructure/database/` — persistence platform (Phase 2 WS2, ADR-012)

Drizzle ORM over the **same `pg.Pool`** the raw-SQL path uses, so tables move
behind repositories one at a time without a big-bang cutover.

| File | Role |
|---|---|
| `schema/` | Drizzle table definitions, one file per owning domain (§5), barrel in `schema/index.ts`. Adopted 1:1 from `server/db/schema.sql` for now. |
| `client.ts` | `createDatabase(pool)` → `Database`; `Transaction` type (the concrete type behind `ServiceContext.tx`). |
| `migrate.ts` | Runtime migration runner (`npm run db:migrate`). Wraps `drizzle-orm`'s migrator and adds status + timing logging (§18.1). node-postgres only. |
| `testing.ts` | `createTestDatabase()` — a migrated `@electric-sql/pglite` instance, typed as `Database`. Repository contract tests run against this and the in-memory adapters. dev-only. |
| `../../migrations/` | Generated SQL + `meta/_journal.json` (journal) + `meta/*_snapshot.json` (checksummed snapshots). |

## Workflow

```bash
# 1. edit schema/*.ts
# 2. generate the next migration (no DB needed) — drizzle-kit via npx, not a dep
npm run db:generate
# 3. review server/migrations/NNNN_*.sql, then apply
npm run db:migrate                      # $DATABASE_URL
DATABASE_URL=<staging> npm run db:migrate   # rehearsal (§18.1)
```

`db:generate` diffs the schema against `meta/`, never the live DB — hand-edits to
the generated SQL (e.g. the `IF NOT EXISTS` in `0000` that lets it adopt the
Phase 1 tables) do not confuse the next generate.

## §18.1 coverage

ordered IDs · journal · per-file checksum · per-migration transaction · safe
rerun (journal-guarded) — from `drizzle-orm`. Status + timing — `migrate.ts`
logs `db.migrate.*` and writes `drizzle.__migration_runs`. Staging rehearsal —
point `DATABASE_URL` at staging. Backup/restore + forward-fix for irreversible
changes — deploy runbook (WS5), not tooling.

## Rules

- Repository *interfaces* live in `server/domains/<domain>/`; only their SQL
  implementations import from here. Interfaces expose domain / `@contracts`
  types, never `InferSelectModel`.
- A `jsonb` column holding a `@contracts` type is `.$type<T>()` **and**
  `schema.parse()`d on read — the DB is a trust boundary (§8).
- `drizzle-kit` is dev/CI-only (run via `npx`); it is not in `package.json`.
