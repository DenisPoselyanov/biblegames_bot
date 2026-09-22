export type TelemetryEventName =
  | 'session_start'
  | 'question_answered'
  | 'quiz_completed'
  | 'practice_stage_completed'
  | 'study_path_advanced'
  | 'daily_task_completed'
  | 'bible_translation_changed'
  // Route analytics (§5.3, WS5) — old route usage, redirect destination, failed
  // mapping, exit after redirect, completion of the new flow.
  | 'legacy_route_visited'
  | 'route_redirect_issued'
  | 'route_redirect_mapping_failed'
  | 'route_redirect_exit'
  | 'route_new_flow_completed'
  // Product analytics (§19, WS10) — Today/lesson/practice/review usage,
  // theme/motion preference changes.
  | 'today_viewed'
  | 'today_action_selected'
  | 'lesson_started'
  | 'lesson_resumed'
  | 'lesson_completed'
  | 'lesson_abandoned'
  | 'practice_session_started'
  | 'practice_session_completed'
  | 'practice_session_abandoned'
  | 'theme_applied'
  | 'motion_intensity_changed';

/**
 * Explicit field shape per event (§19: no free-text/private-reflection
 * fields) — `trackEvent`'s generic signature below makes a call site that
 * passes the wrong shape a type error. Events predating this map keep the
 * permissive `Record<string, unknown>` they always had.
 */
export interface TelemetryPayloadMap {
  session_start: Record<string, unknown>;
  question_answered: Record<string, unknown>;
  quiz_completed: Record<string, unknown>;
  practice_stage_completed: Record<string, unknown>;
  study_path_advanced: Record<string, unknown>;
  daily_task_completed: Record<string, unknown>;
  bible_translation_changed: Record<string, unknown>;
  legacy_route_visited: Record<string, unknown>;
  route_redirect_issued: Record<string, unknown>;
  route_redirect_mapping_failed: Record<string, unknown>;
  route_redirect_exit: Record<string, unknown>;
  route_new_flow_completed: Record<string, unknown>;
  today_viewed: { hasActiveLesson: boolean; hasDueReview: boolean; allDoneToday: boolean };
  today_action_selected: {
    action: 'continue_lesson' | 'review' | 'start_learning' | 'quick_practice' | 'quick_review' | 'post_lesson_practice';
  };
  lesson_started: { lessonId: string };
  lesson_resumed: { lessonId: string; checkpointBlockId: string };
  lesson_completed: { lessonId: string; blockCount: number };
  lesson_abandoned: { lessonId: string; blockIndex: number };
  practice_session_started: { mode: 'practice' | 'review' | 'mistakes'; objectiveId: string };
  practice_session_completed: { mode: 'practice' | 'review' | 'mistakes'; questionCount: number };
  practice_session_abandoned: { mode: 'practice' | 'review' | 'mistakes'; index: number };
  theme_applied: { themeId: string };
  motion_intensity_changed: { intensity: 'full' | 'reduced' | 'minimal' };
}

export interface TelemetryEvent {
  name: TelemetryEventName;
  createdAt: string;
  payload?: Record<string, unknown>;
}

import { getTelegramInitData } from './telegram';

const TELEMETRY_KEY = 'bible-game-telemetry-events';
const API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;

export function trackEvent<N extends TelemetryEventName>(name: N, payload?: TelemetryPayloadMap[N]): void {
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
    const response = await fetch(`${API_BASE}/api/v1/me/telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Identity is the verified Telegram principal; the `x-user-id` header is
        // only a dev-identity fallback for local runs without Telegram.
        ...(initData ? { 'x-telegram-init-data': initData } : { 'x-user-id': userId }),
      },
      body: JSON.stringify({ events: queue }),
    });
    if (response.ok) writeQueue([]);
  } catch {
    /* keep queue for retry */
  }
}
