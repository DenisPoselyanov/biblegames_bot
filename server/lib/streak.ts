/**
 * Server-authoritative streak recomputation (ADR-003). Ports the day-boundary
 * algorithm from src/lib/learning.ts's updateStreak(), but uses UTC calendar
 * days instead of local device time, so a client can't manipulate its clock
 * or timezone to inflate the streak. Ignores whatever streakDays the client
 * sent — the server's own stored lastActiveAt is the source of truth.
 */
export function recomputeStreak(
  existingLastActiveAt: unknown,
  existingStreakDays: unknown,
  now: Date = new Date(),
): { streakDays: number; lastActiveAt: string } {
  const nowIso = now.toISOString();
  const prevStreak =
    typeof existingStreakDays === 'number' && existingStreakDays > 0 ? existingStreakDays : 0;
  const lastIso = typeof existingLastActiveAt === 'string' ? existingLastActiveAt : null;

  if (!lastIso) {
    return { streakDays: 1, lastActiveAt: nowIso };
  }

  const last = new Date(lastIso);
  if (Number.isNaN(last.getTime())) {
    return { streakDays: 1, lastActiveAt: nowIso };
  }

  const lastUtcDay = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate());
  const nowUtcDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffDays = Math.round((nowUtcDay - lastUtcDay) / 86400000);

  if (diffDays <= 0) {
    return { streakDays: prevStreak || 1, lastActiveAt: lastIso };
  }
  if (diffDays === 1) {
    return { streakDays: prevStreak + 1, lastActiveAt: nowIso };
  }
  return { streakDays: 1, lastActiveAt: nowIso };
}
