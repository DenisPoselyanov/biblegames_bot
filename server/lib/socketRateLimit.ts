/**
 * Socket.IO rate limiting (Phase 1 §11, §13) — reuses the HTTP limiter's window
 * store via `hitLimit` (in-memory by default, shared Postgres when wired —
 * Phase 2 WS2 part 4). Key is the verified principal id, else the handshake
 * address (never a payload-supplied name/id). `hitLimit` fails open on a store
 * outage, so this never rejects a legitimate event because the store is down.
 */

import type { Socket } from 'socket.io';
import { hitLimit } from '../middleware/rateLimit';

interface SocketLimitPolicy {
  name: string;
  windowMs: number;
  max: number;
}

/** Per-event policies for the Kahoot lifecycle. */
export const SOCKET_LIMITS: Record<'create_room' | 'join_room' | 'submit_answer', SocketLimitPolicy> = {
  create_room: { name: 'socket.create_room', windowMs: 60_000, max: 10 },
  join_room: { name: 'socket.join_room', windowMs: 60_000, max: 30 },
  submit_answer: { name: 'socket.submit_answer', windowMs: 60_000, max: 120 },
};

function socketKey(socket: Socket): string {
  return socket.data.principal?.userId ?? socket.handshake.address ?? socket.id;
}

/** Resolves true when the event is allowed; false when the caller should reject it. */
export async function allowSocketEvent(
  socket: Socket,
  event: keyof typeof SOCKET_LIMITS,
  disabled = false,
): Promise<boolean> {
  if (disabled) return true;
  const policy = SOCKET_LIMITS[event];
  const { ok } = await hitLimit(policy.name, socketKey(socket), policy.windowMs, policy.max);
  return ok;
}
