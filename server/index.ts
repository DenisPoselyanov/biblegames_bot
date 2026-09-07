import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { KahootCreatePayload, KahootJoinPayload, KahootRoomSettings } from '../src/types/kahoot';
import { loadConfig } from './config/env';
import { assertProductionConfig } from './config/productionValidation';
import { createApp } from './app';
import { installSocketAuth, socketIsAuthenticated } from './auth/socket';
import { isDevIdentityEnabled } from './auth/devIdentityProvider';
import { allowSocketEvent } from './lib/socketRateLimit';
import { log } from './lib/logger';
import { useQuestionsSql } from './db/pgPool';
import { RoomManager } from './roomManager';
import { saveKahootSession } from './kahootSessions';

const { config, warnings } = loadConfig();
for (const warning of warnings) log.warn('config.warning', { warning });

assertProductionConfig(config);

if (isDevIdentityEnabled(config)) {
  log.warn('auth.dev_identity_enabled', {
    detail: 'AUTH_MODE=development — identity is an insecure fixture. Never use this in production.',
  });
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

function ackRateLimited(ack?: (res: unknown) => void): void {
  ack?.({ ok: false, error: 'rate_limited' });
}

io.on('connection', (socket) => {
  const principal = socket.data.principal;

  socket.on('create_room', (payload: KahootCreatePayload, ack?: (res: unknown) => void) => {
    if (!socketIsAuthenticated(socket)) return ackUnauthorized(ack);
    if (!allowSocketEvent(socket, 'create_room', config.rateLimitDisabled)) return ackRateLimited(ack);
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
    if (!allowSocketEvent(socket, 'join_room', config.rateLimitDisabled)) return ackRateLimited(ack);
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
    if (!allowSocketEvent(socket, 'submit_answer', config.rateLimitDisabled)) return ackRateLimited(ack);
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
  log.info('server.start', {
    nodeEnv: config.nodeEnv,
    port: config.port,
    authMode: config.authMode,
    storageProvider: config.storageProvider,
    questionsProvider: useQuestionsSql() ? 'sql' : 'json',
    clientOrigins: config.clientOrigins,
    demoRoutesEnabled: config.demoRoutesEnabled,
    rateLimitDisabled: config.rateLimitDisabled,
  });
});

httpServer.on('error', (err) => {
  log.error('server.http_error', { message: err.message });
});
