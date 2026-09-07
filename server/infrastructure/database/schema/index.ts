/**
 * Drizzle schema barrel (Phase 2 WS2, ADR-012). `drizzle.config.ts` and
 * `createDatabase()` both point here. Authored per-domain; a table belongs to the
 * file for the domain that owns it (`server/domains/README.md` §5).
 */
export * from './progression';
export * from './economy';
export * from './content';
export * from './platform';

import * as progression from './progression';
import * as economy from './economy';
import * as content from './content';
import * as platform from './platform';

/** Every table, for `drizzle(pool, { schema })` and query-builder relations. */
export const schema = {
  ...progression,
  ...economy,
  ...content,
  ...platform,
} as const;
