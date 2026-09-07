import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { schema } from '../schema';

/**
 * Until `server/db/schema.sql` is deleted (once every table is behind a
 * repository), the Drizzle schema and the hand-written SQL must describe the
 * same set of tables — a table added to one but not the other is drift.
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
  it('declares exactly the tables the hand-written schema.sql has', () => {
    const drizzleTables = new Set(
      Object.values(schema)
        .filter((t) => is(t, PgTable))
        .map((t) => getTableName(t as PgTable)),
    );
    expect([...drizzleTables].sort()).toEqual([...tablesInSchemaSql()].sort());
  });
});
