import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  clampAuditLimit,
  type AuditLog,
  type AuditQuery,
  type AuditRecord,
} from './auditLog';

/**
 * JSONL audit adapter for local/dev (Phase 1 §6.4).
 *
 * One JSON object per line, appended with `appendFileSync` — append-only by
 * construction and independent of the debounced `jsonStore` write cache, so an
 * audit record is durable the moment `append` resolves.
 */
export function createJsonlAuditLog(filePath?: string): AuditLog {
  const file = filePath ?? resolve(process.cwd(), '.data', 'audit-log.jsonl');

  function ensureDir(): void {
    const dir = dirname(file);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  return {
    async append(record: AuditRecord) {
      ensureDir();
      appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf8');
    },

    async query(filter: AuditQuery = {}) {
      if (!existsSync(file)) return [];
      const limit = clampAuditLimit(filter.limit);
      const lines = readFileSync(file, 'utf8').split('\n');
      const out: AuditRecord[] = [];
      // Walk newest-first.
      for (let i = lines.length - 1; i >= 0 && out.length < limit; i -= 1) {
        const line = lines[i].trim();
        if (!line) continue;
        let record: AuditRecord;
        try {
          record = JSON.parse(line) as AuditRecord;
        } catch {
          continue;
        }
        if (filter.action && record.action !== filter.action) continue;
        if (filter.actorUserId && record.actor?.userId !== filter.actorUserId) continue;
        if (filter.since && record.at < filter.since) continue;
        out.push(record);
      }
      return out;
    },
  };
}
