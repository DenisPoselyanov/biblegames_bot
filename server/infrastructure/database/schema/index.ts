/**
 * Drizzle schema barrel (Phase 2 WS2, ADR-012). `drizzle.config.ts` and
 * `createDatabase()` both point here. Authored per-domain; a table belongs to the
 * file for the domain that owns it (`server/domains/README.md` §5).
 */
export * from './identity';
export * from './progression';
export * from './economy';
export * from './content';
export * from './learning';
export * from './learningSessions';
export * from './platform';
export * from './validation';
export * from './scriptureEvidence';
export * from './quality';

import * as identity from './identity';
import * as progression from './progression';
import * as economy from './economy';
import * as content from './content';
import * as learning from './learning';
import * as learningSessions from './learningSessions';
import * as platform from './platform';
import * as validation from './validation';
import * as scriptureEvidence from './scriptureEvidence';
import * as quality from './quality';

/** Every table, for `drizzle(pool, { schema })` and query-builder relations. */
export const schema = {
  ...identity,
  ...progression,
  ...economy,
  ...content,
  ...learning,
  ...learningSessions,
  ...platform,
  ...validation,
  ...scriptureEvidence,
  ...quality,
} as const;
