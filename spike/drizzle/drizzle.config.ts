/**
 * drizzle-kit config — Phase 2 WS2 spike (ADR-012 · §18.1 migration framework).
 *
 * `drizzle-kit generate` reads `schema.ts` and emits ordered, checksummed SQL
 * migrations plus `migrations/meta/_journal.json` — the migration journal §18.1
 * asks for, for free. No DB connection needed to author or generate.
 *
 * The real WS2 config moves to the repo root as `drizzle.config.ts` pointing at
 * `server/infrastructure/database/schema.ts` and `server/migrations/`.
 */
import type { Config } from 'drizzle-kit';

export default {
  schema: './spike/drizzle/schema.ts',
  out: './spike/drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // spike only — real config reads a typed env (§19). Never commit a URL.
    url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/biblegames_spike',
  },
  strict: true,
  verbose: true,
} satisfies Config;
