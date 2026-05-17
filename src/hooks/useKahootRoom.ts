import { useCallback, useEffect, useState } from 'react';
import type { KahootRoomSettings, KahootRoomState } from '../types/kahoot';
import {
  emitWithAck,
  getKahootSocket,
  onRoomClosed,
  onRoomState,
} from '../lib/kahootSocket';

const STORAGE_KEY = 'kahoot_session';
const ROOM_STATE_KEY = 'kahoot_room_state';

interface StoredSession {
  code: string;
  playerId: string;
  isHost: boolean;
}

function loadSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function saveSession(session: StoredSession | null) {
  if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(STORAGE_KEY);
}

function loadRoomState(): KahootRoomState | null {
  try {
    const raw = sessionStorage.getItem(ROOM_STATE_KEY);
    return raw ? (JSON.parse(raw) as KahootRoomState) : null;
  } catch {
    return null;
  }
}

function saveRoomState(state: KahootRoomState | null) {
  if (state) sessionStorage.setItem(ROOM_STATE_KEY, JSON.stringify(state));
  else sessionStorage.removeItem(ROOM_STATE_KEY);
}

export function useKahootRoom() {
  const [room, setRoom] = useState<KahootRoomState | null>(loadRoomState);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    const socket = getKahootSocket();

    const onConnect = () => {
      setConnected(true);
      setMyId(socket.id ?? null);
    };
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) onConnect();

    const unsubState = onRoomState((state) => {
      setRoom(state);
      saveRoomState(state);
      setError(null);
    });
    const unsubClosed = onRoomClosed(() => {
      setRoom(null);
      saveRoomState(null);
      saveSession(null);
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      unsubState();
      unsubClosed();
    };
  }, []);

  const createRoom = useCallback(
    async (hostName: string, settings: KahootRoomSettings) => {
      setError(null);
      const res = await emitWithAck<{ hostName: string; settings: KahootRoomSettings }, KahootRoomState>(
        'create_room',
        { hostName, settings },
      );
      if (!res.ok) {
        setError(res.error);
        return null;
      }
      setRoom(res.state);
      saveRoomState(res.state);
      const socket = getKahootSocket();
      saveSession({ code: res.state.code, playerId: socket.id!, isHost: true });
      return res.state;
    },
    [],
  );

  const joinRoom = useCallback(async (code: string, playerName: string) => {
    setError(null);
    const res = await emitWithAck<{ code: string; playerName: string }, KahootRoomState>(
      'join_room',
      { code: code.toUpperCase(), playerName },
    );
    if (!res.ok) {
      setError(res.error);
      return null;
    }
    setRoom(res.state);
    saveRoomState(res.state);
    const socket = getKahootSocket();
    saveSession({
      code: res.state.code,
      playerId: socket.id!,
      isHost: res.state.hostId === socket.id,
    });
    return res.state;
  }, []);

  const updateSettings = useCallback(async (settings: Partial<KahootRoomSettings>) => {
    const res = await emitWithAck<Partial<KahootRoomSettings>, KahootRoomState>(
      'update_settings',
      settings,
    );
    if (!res.ok) {
      setError(res.error);
      return null;
    }
    setRoom(res.state);
    return res.state;
  }, []);

  const startGame = useCallback(async () => {
    const res = await emitWithAck<Record<string, never>, KahootRoomState>('start_game', {});
    if (!res.ok) {
      setError(res.error);
      return null;
    }
    setRoom(res.state);
    return res.state;
  }, []);

  const submitAnswer = useCallback(async (optionIndex: number) => {
    const res = await emitWithAck<{ optionIndex: number }, KahootRoomState>('submit_answer', {
      optionIndex,
    });
    if (!res.ok) {
      setError(res.error);
      return null;
    }
    setRoom(res.state);
    return res.state;
  }, []);

  const leaveRoom = useCallback(() => {
    getKahootSocket().emit('leave_room');
    setRoom(null);
    saveRoomState(null);
    saveSession(null);
  }, []);

  const isHost = room && myId ? room.hostId === myId : false;
  const session = loadSession();

  return {
    room,
    error,
    connected,
    myId,
    isHost,
    session,
    createRoom,
    joinRoom,
    updateSettings,
    startGame,
    submitAnswer,
    leaveRoom,
    setError,
  };
}
