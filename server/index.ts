import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { KahootCreatePayload, KahootJoinPayload, KahootRoomSettings } from '../src/types/kahoot';
import { loadConfig } from './config/env';
import { assertProductionConfig } from './config/productionValidation';
import { createApp } from './app';
import { installSocketAuth, socketIsAuthenticated } from './auth/socket';
import { isDevIdentityEnabled } from './auth/devIdentityProvider';
import { RoomManager } from './roomManager';
import { saveKahootSession } from './kahootSessions';

const { config, warnings } = loadConfig();
for (const warning of warnings) console.warn(`⚠️  config: ${warning}`);

assertProductionConfig(config);

if (isDevIdentityEnabled(config)) {
  console.warn(
    '⚠️  AUTH_MODE=development — identity is an insecure fixture. Never use this in production.',
  );
}

const app = createApp({ config });
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: config.clientOrigins, methods: ['GET', 'POST'] },
});

installSocketAuth(io, config);

const rooms = new RoomManager(
  (code, state) => {
    if (!state) {
      io.to(code).emit('room_closed');
      return;
    }
    io.to(code).emit('room_state', state);
  },
  (roomCode) => {
    const exported = rooms.exportSession(roomCode);
    if (exported) {
      saveKahootSession(exported);
    }
  },
);

function ackUnauthorized(ack?: (res: unknown) => void): void {
  ack?.({ ok: false, error: 'unauthorized' });
}

io.on('connection', (socket) => {
  const principal = socket.data.principal;

  socket.on('create_room', (payload: KahootCreatePayload, ack?: (res: unknown) => void) => {
    if (!socketIsAuthenticated(socket)) return ackUnauthorized(ack);
    try {
      const hostName = principal?.displayName ?? payload.hostName;
      const hostTelegramId = principal?.telegramUserId ?? payload.hostTelegramId;
      const state = rooms.createRoom(socket.id, hostName, payload.settings, hostTelegramId);
      socket.join(state.code);
      ack?.({ ok: true, state });
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('join_room', (payload: KahootJoinPayload, ack?: (res: unknown) => void) => {
    if (!socketIsAuthenticated(socket)) return ackUnauthorized(ack);
    try {
      const state = rooms.joinRoom(payload.code, socket.id, payload.playerName, payload.customField);
      socket.join(state.code);
      ack?.({ ok: true, state });
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('rejoin_room', (payload: KahootJoinPayload, ack?: (res: unknown) => void) => {
    if (!socketIsAuthenticated(socket)) return ackUnauthorized(ack);
    try {
      const state = rooms.rejoinRoom(payload.code, socket.id, payload.playerName);
      socket.join(state.code);
      ack?.({ ok: true, state });
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('join_as_display', (payload: { code: string }, ack?: (res: unknown) => void) => {
    if (!socketIsAuthenticated(socket)) return ackUnauthorized(ack);
    try {
      const state = rooms.joinAsDisplay(payload.code, socket.id);
      socket.join(state.code.toUpperCase());
      ack?.({ ok: true, state });
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('update_settings', (settings: Partial<KahootRoomSettings>, ack?: (res: unknown) => void) => {
    if (!socketIsAuthenticated(socket)) return ackUnauthorized(ack);
    try {
      const state = rooms.updateSettings(socket.id, settings);
      ack?.({ ok: true, state });
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('start_game', (_payload: unknown, ack?: (res: unknown) => void) => {
    if (!socketIsAuthenticated(socket)) return ackUnauthorized(ack);
    void rooms
      .startGame(socket.id)
      .then((state) => ack?.({ ok: true, state }))
      .catch((e: Error) => ack?.({ ok: false, error: e.message }));
  });

  socket.on('submit_answer', (payload: { optionIndex: number }, ack?: (res: unknown) => void) => {
    if (!socketIsAuthenticated(socket)) return ackUnauthorized(ack);
    try {
      const optionIndex = Number(payload?.optionIndex);
      const state = rooms.submitAnswer(socket.id, optionIndex);
      ack?.({ ok: true, state });
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('advance_phase', (_payload: unknown, ack?: (res: unknown) => void) => {
    if (!socketIsAuthenticated(socket)) return ackUnauthorized(ack);
    try {
      const state = rooms.advancePhase(socket.id);
      ack?.({ ok: true, state });
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('leave_room', () => {
    const { code } = rooms.leaveRoom(socket.id);
    if (code) socket.leave(code);
  });

  socket.on('disconnect', () => {
    rooms.handleDisconnect(socket.id);
  });
});

httpServer.listen(config.port, () => {
  console.log(`🎮 Kahoot server: http://localhost:${config.port}`);
});

httpServer.on('error', (err) => {
  console.error('HTTP server error:', err);
});
