import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildAuditRecord } from './auditLog';
import { createJsonlAuditLog } from './jsonlAuditLog';

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'audit-'));
  file = join(dir, 'audit-log.jsonl');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function record(action: string, at: string, actorUserId = 'u1') {
  return buildAuditRecord({
    actor: { userId: actorUserId, authSource: 'telegram' },
    action,
    result: 'ok',
    at,
  });
}

describe('createJsonlAuditLog', () => {
  it('returns [] when the file does not exist yet', async () => {
    const log = createJsonlAuditLog(file);
    expect(await log.query()).toEqual([]);
  });

  it('appends durably and returns records newest-first', async () => {
    const log = createJsonlAuditLog(file);
    await log.append(record('a.one', '2026-01-01T00:00:00.000Z'));
    await log.append(record('a.two', '2026-01-02T00:00:00.000Z'));

    const all = await log.query();
    expect(all.map((r) => r.action)).toEqual(['a.two', 'a.one']);
  });

  it('filters by action, actor and since, and honors limit', async () => {
    const log = createJsonlAuditLog(file);
    await log.append(record('question.update', '2026-01-01T00:00:00.000Z', 'u1'));
    await log.append(record('authz.denied', '2026-01-02T00:00:00.000Z', 'u2'));
    await log.append(record('question.update', '2026-01-03T00:00:00.000Z', 'u1'));

    expect((await log.query({ action: 'question.update' })).length).toBe(2);
    expect((await log.query({ actorUserId: 'u2' })).map((r) => r.action)).toEqual(['authz.denied']);
    expect((await log.query({ since: '2026-01-02T00:00:00.000Z' })).length).toBe(2);
    expect((await log.query({ limit: 1 })).map((r) => r.action)).toEqual(['question.update']);
  });

  it('skips corrupt lines instead of throwing', async () => {
    const log = createJsonlAuditLog(file);
    await log.append(record('a.one', '2026-01-01T00:00:00.000Z'));
    const { appendFileSync } = await import('node:fs');
    appendFileSync(file, 'not json\n', 'utf8');
    await log.append(record('a.two', '2026-01-02T00:00:00.000Z'));

    expect((await log.query()).map((r) => r.action)).toEqual(['a.two', 'a.one']);
  });
});
