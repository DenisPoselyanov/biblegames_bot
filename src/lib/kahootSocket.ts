import { io, type Socket } from 'socket.io-client';
import type { KahootRoomState } from '../types/kahoot';
import { getTelegramInitData } from './telegram';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

let socket: Socket | null = null;

function readDevUserId(): string {
  try {
    return (
      (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number } } } } })
        .Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() ?? 'guest'
    );
  } catch {
    return 'guest';
  }
}

export function getKahootSocket(): Socket {
  if (!socket) {
    const initData = getTelegramInitData();
    socket = io(SERVER_URL, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      // Bind identity at the handshake so the server's secureKahootIdentity
      // path attaches a verified principal instead of trusting event payloads.
      auth: initData ? { initData } : { userId: readDevUserId() },
    });
  }
  return socket;
}

export function disconnectKahootSocket(): void {
  socket?.disconnect();
  socket = null;
}

export type SocketAck<T> = { ok: true; state: T } | { ok: false; error: string };

export function emitWithAck<TPayload, TState>(
  event: string,
  payload: TPayload,
): Promise<SocketAck<TState>> {
  const s = getKahootSocket();
  return new Promise((resolve) => {
    s.emit(event, payload, (response: SocketAck<TState>) => {
      resolve(response ?? { ok: false, error: 'Немає відповіді від сервера' });
    });
  });
}

export function onRoomState(handler: (state: KahootRoomState) => void): () => void {
  const s = getKahootSocket();
  s.on('room_state', handler);
  return () => s.off('room_state', handler);
}

/** `realtimeGatewayV2` envelope — sequence + serverTime drive reconnect recovery. */
export interface RoomEventEnvelope {
  eventId: string;
  roomId: string;
  sequence: number;
  serverTime: string;
  type: 'room_state' | 'room_closed';
  payload: unknown;
}

export function onRoomEvent(handler: (event: RoomEventEnvelope) => void): () => void {
  const s = getKahootSocket();
  s.on('room_event', handler);
  return () => s.off('room_event', handler);
}

export function resyncRoom(
  code: string,
  lastSequence: number,
): Promise<
  { ok: true; event: RoomEventEnvelope | null; missed: boolean } | { ok: false; error: string }
> {
  const s = getKahootSocket();
  return new Promise((resolve) => {
    s.emit('resync_room', { code, lastSequence }, (res: unknown) => {
      resolve(
        (res as { ok?: boolean } | null)?.ok
          ? (res as { ok: true; event: RoomEventEnvelope | null; missed: boolean })
          : { ok: false, error: 'resync_failed' },
      );
    });
  });
}

export function onRoomClosed(handler: () => void): () => void {
  const s = getKahootSocket();
  s.on('room_closed', handler);
  return () => s.off('room_closed', handler);
}
