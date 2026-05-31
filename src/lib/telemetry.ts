export type TelemetryEventName =
  | 'session_start'
  | 'question_answered'
  | 'quiz_completed'
  | 'study_path_advanced'
  | 'daily_task_completed'
  | 'bible_translation_changed';

export interface TelemetryEvent {
  name: TelemetryEventName;
  createdAt: string;
  payload?: Record<string, unknown>;
}

import { getTelegramInitData } from './telegram';

const TELEMETRY_KEY = 'bible-game-telemetry-events';
const API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;

export function trackEvent(name: TelemetryEventName, payload?: Record<string, unknown>): void {
  const entry: TelemetryEvent = { name, createdAt: new Date().toISOString(), payload };
  try {
    const raw = localStorage.getItem(TELEMETRY_KEY);
    const list = raw ? (JSON.parse(raw) as TelemetryEvent[]) : [];
    localStorage.setItem(TELEMETRY_KEY, JSON.stringify([entry, ...list].slice(0, 500)));
  } catch {
    /* noop */
  }
}

function readQueue(): TelemetryEvent[] {
  try {
    return JSON.parse(localStorage.getItem(TELEMETRY_KEY) ?? '[]') as TelemetryEvent[];
  } catch {
    return [];
  }
}

function writeQueue(items: TelemetryEvent[]): void {
  localStorage.setItem(TELEMETRY_KEY, JSON.stringify(items.slice(0, 500)));
}

export async function flushTelemetry(userId: string): Promise<void> {
  if (!API_BASE) return;
  const queue = readQueue();
  if (queue.length === 0) return;
  try {
    const initData = getTelegramInitData();
    const response = await fetch(`${API_BASE}/telemetry/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
        ...(initData ? { 'x-telegram-init-data': initData } : {}),
      },
      body: JSON.stringify({ events: queue }),
    });
    if (response.ok) writeQueue([]);
  } catch {
    /* keep queue for retry */
  }
}
