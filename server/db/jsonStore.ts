import { resolve } from 'node:path';
import type { ServerStore } from './store';
import { readJsonFile, withFileMutex, writeJsonFileAtomic } from './atomicJson';

/** Resolved per call so tests can `process.chdir` into a temp dir. */
function dbFile(): string {
  return resolve(process.cwd(), '.data', 'db.json');
}

interface PersistedDb {
  profiles: Record<string, Record<string, unknown>>;
  stats: Record<string, Record<string, unknown>>;
  studyAnswers: Record<string, Array<Record<string, unknown>>>;
  telemetry: Record<string, Array<Record<string, unknown>>>;
}

const EMPTY_DB: PersistedDb = { profiles: {}, stats: {}, studyAnswers: {}, telemetry: {} };
const TELEMETRY_CAP = 500;

function readDb(): PersistedDb {
  return { ...EMPTY_DB, ...readJsonFile<PersistedDb>(dbFile(), EMPTY_DB) };
}

/**
 * Read → mutate → atomic write, serialized per file (Phase 1 §15 / ADR-006).
 * Replaces the previous debounced writer: a mutation is durable the moment its
 * promise resolves, with no window where a crash loses the last few writes.
 */
function mutateDb(mutator: (db: PersistedDb) => void): Promise<void> {
  const file = dbFile();
  return withFileMutex(file, async () => {
    const db = readDb();
    mutator(db);
    writeJsonFileAtomic(file, db);
  });
}

export const jsonStore: ServerStore = {
  async getProfile(userId) {
    return readDb().profiles[userId] ?? null;
  },
  async setProfile(userId, profile) {
    await mutateDb((db) => {
      db.profiles[userId] = profile;
    });
  },
  async getStats(userId) {
    return readDb().stats[userId] ?? null;
  },
  async setStats(userId, stats) {
    await mutateDb((db) => {
      db.stats[userId] = stats;
    });
  },
  async getStudyAnswers(userId) {
    return readDb().studyAnswers[userId] ?? [];
  },
  async setStudyAnswers(userId, answers) {
    await mutateDb((db) => {
      db.studyAnswers[userId] = answers;
    });
  },
  async appendTelemetry(userId, events) {
    await mutateDb((db) => {
      const prev = db.telemetry[userId] ?? [];
      db.telemetry[userId] = [...events, ...prev].slice(0, TELEMETRY_CAP);
    });
  },
};
