import { z } from 'zod';
import { difficultySchema } from '../enums/index';
import { entityId, isoTimestamp, shortText } from '../schemas/primitives';

/**
 * Socket.IO contract skeleton (Phase 2 §15).
 *
 * WS1 fixes the *envelope* and the client→server command payloads + ack shape so
 * `realtimeGatewayV2` (WS3) has a target to build against. The full server→client
 * event schemas (typed `room_state`, sequence/serverTime recovery) land with the
 * gateway refactor; today the server still emits the legacy `KahootRoomState`.
 */

/** Server→client event kinds carried by the envelope (`realtimeGatewayV2`). */
export const SERVER_EVENT_TYPES = ['room_state', 'room_closed'] as const;
export const serverEventType = z.enum(SERVER_EVENT_TYPES);
export type ServerEventType = z.infer<typeof serverEventType>;

/** Server→client event envelope — sequence + serverTime drive reconnect recovery. */
export function realtimeEvent<T extends z.ZodTypeAny>(payload: T) {
  return z.object({
    eventId: entityId,
    roomId: entityId,
    /** Monotonic per room. Client discards an event whose sequence it already saw. */
    sequence: z.number().int().min(0),
    serverTime: isoTimestamp,
    type: z.string().min(1).max(64),
    payload,
  });
}

/** The envelope the `realtimeGatewayV2` emits as the `room_event` message. */
export const roomEventEnvelope = realtimeEvent(z.unknown());
export type RoomEventEnvelope = z.infer<typeof roomEventEnvelope>;

/** `resync_room` command — client sends the last sequence it applied. */
export const resyncRoomCommand = z.object({
  code: z.string().trim().min(1).max(12),
  lastSequence: z.number().int().min(-1),
});

/** `resync_room` ack — the current envelope plus whether the client fell behind. */
export const resyncRoomAck = z.union([
  z.object({
    ok: z.literal(true),
    event: roomEventEnvelope.nullable(),
    missed: z.boolean(),
  }),
  z.object({ ok: z.literal(false), error: z.string().max(120) }),
]);
export type ResyncRoomAck = z.infer<typeof resyncRoomAck>;

/** Uniform ack for every client→server command. */
export const socketAck = z.union([
  z.object({ ok: z.literal(true), state: z.unknown().optional() }),
  z.object({ ok: z.literal(false), error: z.string().max(120) }),
]);
export type SocketAck = z.infer<typeof socketAck>;

const roomSettings = z
  .object({
    themeIds: z.array(z.string().max(64)).max(50),
    questionCount: z.number().int().min(1).max(100),
    timePerQuestion: z.number().int().min(3).max(120),
    difficulty: difficultySchema,
    playlistId: z.string().max(64).optional(),
    questionIds: z.array(z.string().max(128)).max(200).optional(),
    flowMode: z.enum(['auto', 'manual']),
    scoringMode: z.enum(['classic', 'simple']),
    thinkTimeSec: z.number().int().min(0).max(60),
    hostParticipates: z.boolean(),
    roomTitle: z.string().max(80).optional(),
    customFieldLabel: z.string().max(40).optional(),
  })
  .strict();

/** client→server command payloads, keyed by event name. */
export const clientCommands = {
  create_room: z.object({
    hostName: shortText,
    settings: roomSettings,
    hostTelegramId: z.string().max(64).optional(),
  }),
  join_room: z.object({
    code: z.string().trim().min(1).max(12),
    playerName: shortText,
    customField: z.string().max(120).optional(),
  }),
  rejoin_room: z.object({
    code: z.string().trim().min(1).max(12),
    playerName: shortText,
  }),
  join_as_display: z.object({ code: z.string().trim().min(1).max(12) }),
  update_settings: roomSettings.partial(),
  start_game: z.object({}).strip(),
  submit_answer: z.object({ optionIndex: z.number().int().min(0).max(9) }),
  advance_phase: z.object({}).strip(),
  leave_room: z.object({}).strip(),
  resync_room: resyncRoomCommand,
} as const;

export type ClientCommandName = keyof typeof clientCommands;
