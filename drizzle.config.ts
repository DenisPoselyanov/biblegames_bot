/**
 * Drizzle Kit config (Phase 2 WS2, ADR-012 · §18.1).
 *
 * `npm run db:generate` diffs `server/infrastructure/database/schema/` against the
 * last snapshot in `server/migrations/meta/` and writes the next ordered,
 * checksummed migration. No database connection is used for generate/check.
 *
 * Authored as a plain object (no `import` from `drizzle-kit`) so the config
 * resolves when `drizzle-kit` is run via `npx` without being installed locally —
 * it is a dev/CI-only authoring tool and its large transitive tree does not
 * belong in the app lockfile. The runtime migration runner
 * (`server/infrastructure/database/migrate.ts`) needs only `drizzle-orm`.
 *
 * @type {import('drizzle-kit').Config}
 */
export default {
  schema: './server/infrastructure/database/schema/index.ts',
  out: './server/migrations',
  dialect: 'postgresql',
  casing: 'snake_case',
  strict: true,
  verbose: true,
  dbCredentials: {
    // Only feeds dev-only `drizzle-kit push`/`studio`. Never commit a real URL.
    url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/biblegames',
  },
};
