/**
 * Drizzle row types ↔ `@contracts` Zod schemas — Phase 2 WS2 spike (ADR-012).
 *
 * The biggest ADR-012 risk is repeating the Phase 1 mistake (§25): letting an
 * ORM's inferred types silently become the API contract. This file works through
 * how the two type systems should relate.
 *
 * Conclusion (see ./FINDINGS.md §3): `@contracts` stays the single source for
 * every *boundary* shape. Drizzle types are *storage* shapes. The repository is
 * the mapping seam. drizzle-zod is used only for internal insert guards, never
 * re-exported as a contract.
 */

import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
  meContract,
  progressionSnapshot,
  type ProgressionSnapshot,
} from '../../contracts/index';
import { progressionSnapshots, userPreferences, users } from './schema';

/* 1. Storage row types are inferred, not written ------------------------------ */

type UserRow = InferSelectModel<typeof users>;
type UserInsert = InferInsertModel<typeof users>;
type PreferencesRow = InferSelectModel<typeof userPreferences>;

/* 2. jsonb column pinned to the CONTRACT type -------------------------------- */

// `snapshot` is typed as `ProgressionSnapshot` because schema.ts declared
// `.$type<ProgressionSnapshot>()`. Drizzle does not validate it at runtime — the
// repository must `progressionSnapshot.parse()` on the way out of the DB, exactly
// as a route parses on the way in.
type SnapshotRow = InferSelectModel<typeof progressionSnapshots>;
const _snapshotIsContractType: SnapshotRow['snapshot'] extends ProgressionSnapshot
  ? true
  : false = true;

export function readSnapshot(row: SnapshotRow): ProgressionSnapshot {
  // Trust boundary: bytes from the DB are validated like any other input (§8).
  return progressionSnapshot.parse(row.snapshot);
}

/* 3. Boundary response is BUILT from storage rows, never `= row` ------------- */

type MeResponse = ReturnType<typeof meContract.meResponse.parse>;

export function toMeResponse(
  user: UserRow,
  prefs: PreferencesRow | null,
  roles: string[],
  permissions: string[],
): MeResponse {
  void prefs; // preferences ride a different surface; shown here for the mapping shape
  return meContract.meResponse.parse({
    userId: user.id,
    displayName: user.displayName,
    username: user.username,
    languageCode: user.languageCode,
    authSource: 'telegram-init-data',
    roles,
    permissions,
  });
}

/* 4. What Drizzle inference gives us for free ------------------------------- */

// - `UserInsert.id` is required, timestamps optional (they have defaults).
// - `nullable` columns infer as `T | null`, matching the contract's `.nullable()`.
// - a bad column reference is a compile error, not a runtime 500.
export const _typeChecks = {
  insert: (u: UserInsert): string => u.id,
  nullableName: (u: UserRow): string | null => u.displayName,
} as const;

export type { UserRow, UserInsert, PreferencesRow, SnapshotRow };
