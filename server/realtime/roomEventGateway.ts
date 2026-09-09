/**
 * Room event gateway (Phase 2 §15, acc. #11) — `realtimeGatewayV2`.
 *
 * Wraps the raw `io.to(room).emit(...)` broadcast in a typed `RealtimeEvent`
 * envelope with a per-room monotonic `sequence` and a `serverTime` from the
 * clock service. The client discards an envelope whose `sequence` it has already
 * applied and, after a reconnect, calls `resync_room` with its last sequence to
 * learn whether it fell behind and to get the current state — without restarting
 * timers or replaying victory animations.
 *
 * Legacy behaviour is untouched: when the flag is off this gateway is never
 * constructed and only the raw `room_state` / `room_closed` emits happen.
 */
import type { Server } from 'socket.io';
import type { RoomEventEnvelope, ServerEventType } from '../../contracts/events/realtime';
import type { Clock } from './clock';

interface RoomChannel {
  sequence: number;
  last: RoomEventEnvelope | null;
}

export interface RoomEventGateway {
  /** Broadcast a new envelope to a room; returns the envelope that was sent. */
  emit(roomId: string, type: ServerEventType, payload: unknown): RoomEventEnvelope;
  /** The most recent envelope for a room, or `null` if none / room dropped. */
  latest(roomId: string): RoomEventEnvelope | null;
  /** The current sequence number for a room (`-1` before the first emit). */
  sequenceOf(roomId: string): number;
  /** Forget a room once it is closed. */
  drop(roomId: string): void;
}

let counter = 0;
const nextEventId = (clock: Clock): string =>
  `evt_${clock.now().toString(36)}_${(++counter).toString(36)}`;

export function createRoomEventGateway(io: Server, clock: Clock): RoomEventGateway {
  const channels = new Map<string, RoomChannel>();

  const channel = (roomId: string): RoomChannel => {
    let c = channels.get(roomId);
    if (!c) channels.set(roomId, (c = { sequence: -1, last: null }));
    return c;
  };

  return {
    emit(roomId, type, payload) {
      const c = channel(roomId);
      c.sequence += 1;
      const envelope: RoomEventEnvelope = {
        eventId: nextEventId(clock),
        roomId,
        sequence: c.sequence,
        serverTime: clock.nowIso(),
        type,
        payload,
      };
      c.last = envelope;
      io.to(roomId).emit('room_event', envelope);
      return envelope;
    },
    latest(roomId) {
      return channels.get(roomId)?.last ?? null;
    },
    sequenceOf(roomId) {
      return channels.get(roomId)?.sequence ?? -1;
    },
    drop(roomId) {
      channels.delete(roomId);
    },
  };
}
