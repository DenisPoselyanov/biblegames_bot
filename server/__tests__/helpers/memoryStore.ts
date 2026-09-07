import type { ServerStore } from '../../db/store';

/** In-memory ServerStore for integration tests — no file or DB writes. */
export function createMemoryStore(): ServerStore {
  const profiles = new Map<string, Record<string, unknown>>();
  const stats = new Map<string, Record<string, unknown>>();
  const studyAnswers = new Map<string, Array<Record<string, unknown>>>();
  const telemetry = new Map<string, Array<Record<string, unknown>>>();

  return {
    async getProfile(userId) {
      return profiles.get(userId) ?? null;
    },
    async setProfile(userId, profile) {
      profiles.set(userId, profile);
    },
    async getStats(userId) {
      return stats.get(userId) ?? null;
    },
    async setStats(userId, value) {
      stats.set(userId, value);
    },
    async getStudyAnswers(userId) {
      return studyAnswers.get(userId) ?? [];
    },
    async setStudyAnswers(userId, answers) {
      studyAnswers.set(userId, answers);
    },
    async appendTelemetry(userId, events) {
      telemetry.set(userId, [...events, ...(telemetry.get(userId) ?? [])]);
    },
  };
}
