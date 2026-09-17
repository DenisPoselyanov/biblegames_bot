function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizeStatsBody(userId: string, body: unknown): Record<string, unknown> {
  if (!isRecord(body)) return { userId };
  const themes = isRecord(body.themes) ? body.themes : {};
  return {
    userId,
    themes,
    lastUpdated:
      typeof body.lastUpdated === 'string' ? body.lastUpdated : new Date().toISOString(),
  };
}

export function sanitizeStudyAnswers(body: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(body)) return [];
  return body.slice(0, 5000).filter(isRecord);
}

/**
 * Payload key allowlist per event name (§19 privacy) — mirrors
 * `TelemetryPayloadMap` in `src/lib/telemetry.ts`. Keys not listed for a
 * known event are dropped; an unrecognized event name gets an empty payload.
 * Defense-in-depth: only our own typed client code emits events today, but
 * this guarantees a future call-site regression (e.g. a stray free-text
 * field) can never reach storage.
 */
const TELEMETRY_EVENT_ALLOWED_KEYS: Record<string, string[]> = {
  today_viewed: ['hasActiveLesson', 'hasDueReview', 'allDoneToday'],
  today_action_selected: ['action'],
  lesson_started: ['lessonId'],
  lesson_resumed: ['lessonId', 'checkpointBlockId'],
  lesson_completed: ['lessonId', 'blockCount'],
  lesson_abandoned: ['lessonId', 'blockIndex'],
  practice_session_started: ['mode', 'objectiveId'],
  practice_session_completed: ['mode', 'questionCount'],
  practice_session_abandoned: ['mode', 'index'],
  theme_applied: ['themeId'],
  motion_intensity_changed: ['intensity'],
};

function sanitizeTelemetryEvent(event: Record<string, unknown>): Record<string, unknown> {
  const allowedKeys = typeof event.name === 'string' ? TELEMETRY_EVENT_ALLOWED_KEYS[event.name] : undefined;
  if (!allowedKeys || !isRecord(event.payload)) return event;
  const payload: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (key in event.payload) payload[key] = event.payload[key];
  }
  return { ...event, payload };
}

export function sanitizeTelemetryEvents(body: unknown): Array<Record<string, unknown>> {
  if (!isRecord(body) || !Array.isArray(body.events)) return [];
  return body.events.slice(0, 100).filter(isRecord).map(sanitizeTelemetryEvent);
}
