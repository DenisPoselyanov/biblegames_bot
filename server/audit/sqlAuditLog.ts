import { getPool } from '../db/pgPool';
import {
  clampAuditLimit,
  type AuditLog,
  type AuditQuery,
  type AuditRecord,
} from './auditLog';

/**
 * SQL audit adapter (Phase 1 §6.4). Inserts into and reads from `audit_log`
 * (see server/db/schema.sql). Append-only: no update/delete paths.
 */
export function createSqlAuditLog(): AuditLog {
  return {
    async append(record: AuditRecord) {
      const pool = await getPool();
      await pool.query(
        `insert into audit_log(
           actor_user_id, actor_auth_source, action, target, result, request_id, created_at, metadata)
         values($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::jsonb)`,
        [
          record.actor.userId,
          record.actor.authSource,
          record.action,
          record.target ?? null,
          record.result,
          record.requestId ?? null,
          record.at,
          JSON.stringify(record.metadata ?? {}),
        ],
      );
    },

    async query(filter: AuditQuery = {}) {
      const pool = await getPool();
      const where: string[] = [];
      const params: unknown[] = [];
      if (filter.action) {
        params.push(filter.action);
        where.push(`action = $${params.length}`);
      }
      if (filter.actorUserId) {
        params.push(filter.actorUserId);
        where.push(`actor_user_id = $${params.length}`);
      }
      if (filter.since) {
        params.push(filter.since);
        where.push(`created_at >= $${params.length}::timestamptz`);
      }
      params.push(clampAuditLimit(filter.limit));
      const sql =
        `select actor_user_id, actor_auth_source, action, target, result, request_id, created_at, metadata
         from audit_log
         ${where.length ? `where ${where.join(' and ')}` : ''}
         order by created_at desc, id desc
         limit $${params.length}`;
      const rows = await pool.query(sql, params);
      return rows.rows.map((row) => ({
        at:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at),
        actor: {
          userId: (row.actor_user_id as string | null) ?? null,
          authSource: (row.actor_auth_source as string | null) ?? null,
        },
        action: String(row.action),
        target: (row.target as string | null) ?? undefined,
        result: row.result as AuditRecord['result'],
        requestId: (row.request_id as string | null) ?? undefined,
        metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
      }));
    },
  };
}
