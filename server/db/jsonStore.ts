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
const WRITE_DEBOUNCE_MS = 400;
const TELEMETRY_CAP = 500;

let cachedDb: PersistedDb | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
function ensureDbFile(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DB_FILE)) writeFileSync(DB_FILE, JSON.stringify(EMPTY_DB, null, 2), 'utf8');
}

function readDb(): PersistedDb {
  if (cachedDb) return cachedDb;
  ensureDbFile();
  try {
    cachedDb = { ...EMPTY_DB, ...(JSON.parse(readFileSync(DB_FILE, 'utf8')) as PersistedDb) };
  } catch {
    cachedDb = { ...EMPTY_DB };
  }
  return cachedDb;
}

function flushDb(): void {
  if (!cachedDb) return;
  ensureDbFile();
  const dir = dirname(DB_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(DB_FILE, JSON.stringify(cachedDb, null, 2), 'utf8');
}

function scheduleWrite(): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    flushDb();
  }, WRITE_DEBOUNCE_MS);
}

function mutateDb(mutator: (db: PersistedDb) => void): void {
  const db = readDb();
  mutator(db);
  scheduleWrite();
}

export const jsonStore: ServerStore = {
  async getProfile(userId) {
    return readDb().profiles[userId] ?? null;
  },
  async setProfile(userId, profile) {
    mutateDb((db) => {
      db.profiles[userId] = profile;
    });
  },
  async getStats(userId) {
    return readDb().stats[userId] ?? null;
  },
  async setStats(userId, stats) {
    mutateDb((db) => {
      db.stats[userId] = stats;
    });
  },
  async getStudyAnswers(userId) {
    return readDb().studyAnswers[userId] ?? [];
  },
  async setStudyAnswers(userId, answers) {
    mutateDb((db) => {
      db.studyAnswers[userId] = answers;
    });
  },
  async appendTelemetry(userId, events) {
    mutateDb((db) => {
      const prev = db.telemetry[userId] ?? [];
      db.telemetry[userId] = [...events, ...prev].slice(0, TELEMETRY_CAP);
    });
  },
};
