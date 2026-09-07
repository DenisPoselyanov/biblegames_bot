# Drizzle spike (Phase 2 WS2 · ADR-012)

**Status:** exploratory. This folder is *not* wired into `server/` or the build.
It exists to answer the open questions in
[`docs/DECISIONS.md` → ADR-012](../../docs/DECISIONS.md) before WS2 writes the real
persistence layer. Delete it (or fold the useful parts into
`server/infrastructure/database/`) once ADR-012 moves to **accepted**.

## What it contains

| File | Purpose |
|---|---|
| `schema.ts` | Candidate Drizzle schema for a representative slice of the §9 core tables — `users`, `external_identities`, `roles`, `user_roles`, `user_preferences`, `wallet_ledger`, `progression_snapshots`, `migration_records`. Translated from the hand-written `server/db/schema.sql` + Phase 2 §9. |
| `contract-bridge.ts` | Proves how Drizzle's inferred row types line up with the canonical `@contracts` Zod schemas — the single biggest ADR-012 risk (§25 "shared types are not shared contracts"). |
| `repositories.ts` | `UserRepository` / `ProgressionRepository` interface sketch (§10) with a Drizzle implementation, showing the `Transaction` handle threading into `ServiceContext`. |
| `drizzle.config.ts` | `drizzle-kit` config — migration journal / checksum lives in `./migrations/`. |
| `FINDINGS.md` | The actual ADR-012 answers. **This is the deliverable.** |

## How to run

```bash
# deps are installed with --no-save for the spike; see FINDINGS.md for the
# exact versions to add properly in the real WS2 change.
npm install --no-save drizzle-orm@^0.44.5 drizzle-kit@^0.31.10

# generate the first migration from schema.ts (no DB connection needed)
npx drizzle-kit generate --config spike/drizzle/drizzle.config.ts

# type-check the spike against the repo's server tsconfig settings
npx tsc --noEmit --strict --moduleResolution bundler --module esnext \
  --skipLibCheck spike/drizzle/*.ts
```

A live Postgres is only needed for `drizzle-kit migrate` / `push` and the
repository round-trip test — not for schema authoring or migration generation.
