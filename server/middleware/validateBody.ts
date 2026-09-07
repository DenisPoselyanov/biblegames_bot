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

export function sanitizeTelemetryEvents(body: unknown): Array<Record<string, unknown>> {
  if (!isRecord(body) || !Array.isArray(body.events)) return [];
  return body.events.slice(0, 100).filter(isRecord);
}
