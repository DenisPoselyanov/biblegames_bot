/**
 * Socket.IO rate limiting (Phase 1 §11, §13) — reuses the HTTP limiter's
 * in-memory window store via `hitLimit`. Key is the verified principal id, else
 * the handshake address (never a payload-supplied name/id).
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

/** True when the event is allowed; false when the caller should reject it. */
export function allowSocketEvent(
  socket: Socket,
  event: keyof typeof SOCKET_LIMITS,
  disabled = false,
): boolean {
  if (disabled) return true;
  const policy = SOCKET_LIMITS[event];
  return hitLimit(policy.name, socketKey(socket), policy.windowMs, policy.max).ok;
}
