import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DATA_DIR = resolve(process.cwd(), '.data');
const DB_FILE = resolve(DATA_DIR, 'db.json');

interface PersistedDb {
  profiles: Record<string, Record<string, unknown>>;
  stats: Record<string, Record<string, unknown>>;
  studyAnswers: Record<string, Array<Record<string, unknown>>>;
  telemetry: Record<string, Array<Record<string, unknown>>>;
}

const EMPTY_DB: PersistedDb = {
  profiles: {},
  stats: {},
  studyAnswers: {},
  telemetry: {},
};

function ensureDbFile(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DB_FILE)) writeFileSync(DB_FILE, JSON.stringify(EMPTY_DB, null, 2), 'utf8');
}

function readDb(): PersistedDb {
  ensureDbFile();
  try {
    const raw = readFileSync(DB_FILE, 'utf8');
    return { ...EMPTY_DB, ...(JSON.parse(raw) as PersistedDb) };
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

export const dbStore = {
  getProfile(userId: string): Record<string, unknown> | null {
    const db = readDb();
    return db.profiles[userId] ?? null;
  },
  setProfile(userId: string, profile: Record<string, unknown>): void {
    const db = readDb();
    db.profiles[userId] = profile;
    writeDb(db);
  },
  getStats(userId: string): Record<string, unknown> | null {
    const db = readDb();
    return db.stats[userId] ?? null;
  },
  setStats(userId: string, stats: Record<string, unknown>): void {
    const db = readDb();
    db.stats[userId] = stats;
    writeDb(db);
  },
  getStudyAnswers(userId: string): Array<Record<string, unknown>> {
    const db = readDb();
    return db.studyAnswers[userId] ?? [];
  },
  setStudyAnswers(userId: string, answers: Array<Record<string, unknown>>): void {
    const db = readDb();
    db.studyAnswers[userId] = answers;
    writeDb(db);
  },
  appendTelemetry(userId: string, events: Array<Record<string, unknown>>): void {
    const db = readDb();
    const prev = db.telemetry[userId] ?? [];
    db.telemetry[userId] = [...events, ...prev].slice(0, 5000);
    writeDb(db);
  },
};
