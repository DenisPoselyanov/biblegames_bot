/**
 * Append-only audit log (Phase 1 §6.4).
 *
 * Records security-sensitive actions: role changes, admin/content mutations,
 * wallet adjustments, migration claims, authz denials, security-config failures.
 * A record carries actor, action, target, result, timestamp, request id and
 * *safe* metadata only — never secrets or raw private payloads.
 *
 * The port has two adapters (see ./index.ts): a JSONL file for local/dev and a
 * SQL table for production. Writes are append-only by construction.
 */

export type AuditResult = 'ok' | 'denied' | 'error';

export interface AuditActor {
  userId: string | null;
  authSource: string | null;
}

export interface AuditRecord {
  /** ISO-8601 timestamp of the action. */
  at: string;
  actor: AuditActor;
  /** Dotted action name, e.g. `question.update`, `authz.denied`, `role.change`. */
  action: string;
  /** What the action targeted (an id), when applicable. */
  target?: string;
  result: AuditResult;
  requestId?: string;
  /** Small, non-sensitive context. Run through `redactAuditMetadata` first. */
  metadata?: Record<string, unknown>;
}

export interface AuditQuery {
  action?: string;
  actorUserId?: string;
  /** Only records at or after this ISO timestamp. */
  since?: string;
  /** Newest-first cap. Default 100, hard max 1000. */
  limit?: number;
}

export interface AuditLog {
  append(record: AuditRecord): Promise<void>;
  /** Newest-first. */
  query(filter?: AuditQuery): Promise<AuditRecord[]>;
}

export const AUDIT_QUERY_DEFAULT_LIMIT = 100;
export const AUDIT_QUERY_MAX_LIMIT = 1000;

export function clampAuditLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit) || (limit ?? 0) <= 0) return AUDIT_QUERY_DEFAULT_LIMIT;
  return Math.min(Math.floor(limit as number), AUDIT_QUERY_MAX_LIMIT);
}

const MAX_METADATA_KEYS = 20;
const MAX_STRING_LEN = 500;

/**
 * Shallow-sanitize metadata before it is persisted: cap the number of keys,
 * truncate long strings, keep only JSON primitives / string arrays, and drop
 * anything that looks like a credential by key name.
 */
export function redactAuditMetadata(
  input: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!input) return undefined;
  const out: Record<string, unknown> = {};
  let keys = 0;
  for (const [key, value] of Object.entries(input)) {
    if (keys >= MAX_METADATA_KEYS) break;
    if (/token|secret|password|authorization|cookie|hash|key/i.test(key)) {
      out[key] = '[redacted]';
      keys += 1;
      continue;
    }
    if (typeof value === 'string') {
      out[key] = value.length > MAX_STRING_LEN ? `${value.slice(0, MAX_STRING_LEN)}…` : value;
    } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = value.slice(0, 50).map((v) => (typeof v === 'string' ? v.slice(0, MAX_STRING_LEN) : v));
    } else {
      continue;
    }
    keys += 1;
  }
  return out;
}

/** Build a normalized, redacted record from loosely-typed inputs. */
export function buildAuditRecord(input: {
  actor: AuditActor;
  action: string;
  target?: string;
  result: AuditResult;
  requestId?: string;
  metadata?: Record<string, unknown>;
  at?: string;
}): AuditRecord {
  return {
    at: input.at ?? new Date().toISOString(),
    actor: input.actor,
    action: input.action,
    target: input.target,
    result: input.result,
    requestId: input.requestId,
    metadata: redactAuditMetadata(input.metadata),
  };
}

/** In-memory adapter — used by tests and as a safe fallback. */
export function createMemoryAuditLog(): AuditLog & { records: AuditRecord[] } {
  const records: AuditRecord[] = [];
  return {
    records,
    async append(record) {
      records.push(record);
    },
    async query(filter = {}) {
      const limit = clampAuditLimit(filter.limit);
      return records
        .filter((r) => (filter.action ? r.action === filter.action : true))
        .filter((r) => (filter.actorUserId ? r.actor.userId === filter.actorUserId : true))
        .filter((r) => (filter.since ? r.at >= filter.since : true))
        .slice()
        .reverse()
        .slice(0, limit);
    },
  };
}
