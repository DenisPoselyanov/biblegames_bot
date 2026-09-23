/**
 * Generic field-level diff between two revision snapshots (Phase 4 WS2,
 * ADR-019 §4). Domain-owned, dependency-free — shared by `content` (question
 * revisions) and `learning` (lesson revisions) rather than duplicated per
 * domain. This is the data WS8's review editor renders side-by-side, not a
 * UI concern itself.
 */

export interface FieldDiff {
  field: string;
  before: unknown;
  after: unknown;
}

export interface RevisionDiff {
  changed: boolean;
  fields: FieldDiff[];
}

/**
 * Compare `before`/`after` on exactly `fields`, by deep JSON equality per
 * field — array/object fields (options, blocks, scriptureRefs) diff as a
 * whole rather than needing bespoke per-field logic. `before: null` means
 * "new revision": every field present on `after` is reported as changed.
 */
export function diffFields<T extends object>(
  before: T | null,
  after: T,
  fields: readonly (keyof T & string)[],
): RevisionDiff {
  const diffs: FieldDiff[] = [];
  for (const field of fields) {
    const b = before ? before[field] : undefined;
    const a = after[field];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      diffs.push({ field, before: b ?? null, after: a });
    }
  }
  return { changed: diffs.length > 0, fields: diffs };
}
