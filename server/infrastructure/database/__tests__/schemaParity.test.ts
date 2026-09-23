import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { schema } from '../schema';

/**
 * Until `server/db/schema.sql` is deleted (once every legacy table is behind a
 * repository), every table it declares must also exist in the Drizzle schema —
 * a legacy table dropped from Drizzle is drift. The Drizzle schema is a
 * superset: WS2 adds new tables (identity, RBAC, …) that schema.sql never had.
 */
const schemaSqlPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../db/schema.sql',
);

function tablesInSchemaSql(): Set<string> {
  const sql = readFileSync(schemaSqlPath, 'utf8');
  const names = new Set<string>();
  for (const m of sql.matchAll(/create table if not exists\s+([a-z_]+)/gi)) {
    names.add(m[1].toLowerCase());
  }
  return names;
}

describe('Drizzle schema ↔ server/db/schema.sql parity', () => {
  const drizzleTables = new Set(
    Object.values(schema)
      .filter((t) => is(t, PgTable))
      .map((t) => getTableName(t as PgTable)),
  );

  it('covers every legacy table from schema.sql', () => {
    const missing = [...tablesInSchemaSql()].filter((t) => !drizzleTables.has(t));
    expect(missing, `legacy tables absent from the Drizzle schema: ${missing.join(', ')}`).toEqual(
      [],
    );
  });

  it('new (WS2+) tables are limited to the known identity/RBAC + platform set', () => {
    const legacy = tablesInSchemaSql();
    const added = [...drizzleTables].filter((t) => !legacy.has(t)).sort();
    expect(added).toEqual(
      [
        'external_identities',
        'rate_limit_counters',
        'roles',
        'user_preferences',
        'user_roles',
        'users',
        // WS3 §14 — canonical content revision model
        'question_revisions',
        'scripture_references',
        'content_sets',
        'content_set_versions',
        'content_set_items',
        // §18.2 / ADR-016 — progression + entitlement decomposition
        'progression_state',
        'achievement_grants',
        'player_theme_stats',
        'progression_backfill_records',
        'entitlements',
        // Phase 3 WS1 / ADR-017 — Learning domain
        'learning_plans',
        'learning_modules',
        'learning_objectives',
        'lessons',
        'lesson_blocks',
        // Phase 3 WS2 — lesson/practice session tracking
        'lesson_sessions',
        'practice_sessions',
        // Phase 4 WS2 / ADR-019 — lesson revision model
        'lesson_revisions',
        // Phase 4 WS3 — validation-pipeline finding storage
        'content_validation_findings',
        // Phase 4 WS4 — Scripture-verification evidence storage
        'scripture_evidence',
        // Phase 4 WS9 — player content reports + anonymous option-pick counters
        'content_reports',
        'question_option_picks',
      ].sort(),
    );
  });
});
