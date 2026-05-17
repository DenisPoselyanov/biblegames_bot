import { io, type Socket } from 'socket.io-client';
import type { KahootRoomState } from '../types/kahoot';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

let socket: Socket | null = null;

export function getKahootSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
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

export function onRoomClosed(handler: () => void): () => void {
  const s = getKahootSocket();
  s.on('room_closed', handler);
  return () => s.off('room_closed', handler);
}
