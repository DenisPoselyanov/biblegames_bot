import type { ServerConfig } from '../config/env';
import type { AuditLog } from './auditLog';
import { createJsonlAuditLog } from './jsonlAuditLog';
import { createSqlAuditLog } from './sqlAuditLog';

export type {
  AuditLog,
  AuditRecord,
  AuditActor,
  AuditResult,
  AuditQuery,
} from './auditLog';
export { buildAuditRecord, redactAuditMetadata, createMemoryAuditLog } from './auditLog';

/** Pick the audit adapter for the active storage provider (Phase 1 §6.4). */
export function createAuditLog(config: ServerConfig): AuditLog {
  return config.storageProvider === 'sql' ? createSqlAuditLog() : createJsonlAuditLog();
}
