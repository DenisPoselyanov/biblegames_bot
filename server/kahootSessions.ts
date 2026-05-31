import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { KahootSessionRecord } from '../src/types/kahoot';

const DATA_DIR = resolve(process.cwd(), '.data');
const SESSIONS_FILE = resolve(DATA_DIR, 'kahoot-sessions.json');

function ensureFile(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(SESSIONS_FILE)) writeFileSync(SESSIONS_FILE, '[]', 'utf8');
}

function readSessions(): KahootSessionRecord[] {
  ensureFile();
  try {
    return JSON.parse(readFileSync(SESSIONS_FILE, 'utf8')) as KahootSessionRecord[];
  } catch {
    return [];
  }
}

function writeSessions(sessions: KahootSessionRecord[]): void {
  ensureFile();
  const dir = dirname(SESSIONS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf8');
}

export function saveKahootSession(
  data: Omit<KahootSessionRecord, 'id'>,
): KahootSessionRecord {
  const sessions = readSessions();
  const record: KahootSessionRecord = {
    id: `ks_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...data,
  };
  sessions.unshift(record);
  writeSessions(sessions.slice(0, 500));
  return record;
}

export function listKahootSessions(limit = 50): KahootSessionRecord[] {
  return readSessions().slice(0, limit);
}

export function getKahootSession(id: string): KahootSessionRecord | null {
  return readSessions().find((s) => s.id === id) ?? null;
}

/** Neutralize Excel formula injection */
export function csvEscape(value: string | number): string {
  const str = String(value);
  const safe = /^[=+\-@]/.test(str) ? `'${str}` : str;
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function sessionToCsv(session: KahootSessionRecord): string {
  const lines = [
    'rank,name,score,custom_field',
    ...session.players.map((p) =>
      [csvEscape(p.rank), csvEscape(p.name), csvEscape(p.score), csvEscape(p.customField ?? '')].join(','),
    ),
  ];
  return lines.join('\n');
}
