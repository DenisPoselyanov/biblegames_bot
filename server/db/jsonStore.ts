import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { ServerStore } from './store';

const DATA_DIR = resolve(process.cwd(), '.data');
const DB_FILE = resolve(DATA_DIR, 'db.json');

interface PersistedDb {
  profiles: Record<string, Record<string, unknown>>;
  stats: Record<string, Record<string, unknown>>;
  studyAnswers: Record<string, Array<Record<string, unknown>>>;
  telemetry: Record<string, Array<Record<string, unknown>>>;
}

const EMPTY_DB: PersistedDb = { profiles: {}, stats: {}, studyAnswers: {}, telemetry: {} };

function ensureDbFile(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DB_FILE)) writeFileSync(DB_FILE, JSON.stringify(EMPTY_DB, null, 2), 'utf8');
}

function readDb(): PersistedDb {
  ensureDbFile();
  try {
    return { ...EMPTY_DB, ...(JSON.parse(readFileSync(DB_FILE, 'utf8')) as PersistedDb) };
  } catch {
    return { ...EMPTY_DB };
  }
}

function writeDb(db: PersistedDb): void {
  ensureDbFile();
  const dir = dirname(DB_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

export const jsonStore: ServerStore = {
  async getProfile(userId) {
    return readDb().profiles[userId] ?? null;
  },
  async setProfile(userId, profile) {
    const db = readDb();
    db.profiles[userId] = profile;
    writeDb(db);
  },
  async getStats(userId) {
    return readDb().stats[userId] ?? null;
  },
  async setStats(userId, stats) {
    const db = readDb();
    db.stats[userId] = stats;
    writeDb(db);
  },
  async getStudyAnswers(userId) {
    return readDb().studyAnswers[userId] ?? [];
  },
  async setStudyAnswers(userId, answers) {
    const db = readDb();
    db.studyAnswers[userId] = answers;
    writeDb(db);
  },
  async appendTelemetry(userId, events) {
    const db = readDb();
    const prev = db.telemetry[userId] ?? [];
    db.telemetry[userId] = [...events, ...prev].slice(0, 5000);
    writeDb(db);
  },
};
