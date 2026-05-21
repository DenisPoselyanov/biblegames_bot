export interface ServerStore {
  getProfile(userId: string): Promise<Record<string, unknown> | null>;
  setProfile(userId: string, profile: Record<string, unknown>): Promise<void>;
  getStats(userId: string): Promise<Record<string, unknown> | null>;
  setStats(userId: string, stats: Record<string, unknown>): Promise<void>;
  getStudyAnswers(userId: string): Promise<Array<Record<string, unknown>>>;
  setStudyAnswers(userId: string, answers: Array<Record<string, unknown>>): Promise<void>;
  appendTelemetry(userId: string, events: Array<Record<string, unknown>>): Promise<void>;
}
