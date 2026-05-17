import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type { KahootCreatePayload, KahootJoinPayload, KahootRoomSettings } from '../src/types/kahoot';
import { RoomManager } from './roomManager';

const PORT = Number(process.env.PORT || 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();
app.use(cors({ origin: [CLIENT_ORIGIN, 'http://127.0.0.1:5173'], credentials: true }));
app.get('/health', (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [CLIENT_ORIGIN, 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
  },
});

const rooms = new RoomManager((code, state) => {
  if (!state) {
    io.to(code).emit('room_closed');
    return;
  }
  io.to(code).emit('room_state', state);
});

io.on('connection', (socket) => {
  socket.on('create_room', (payload: KahootCreatePayload, ack?: (res: unknown) => void) => {
    try {
      const state = rooms.createRoom(socket.id, payload.hostName, payload.settings);
      socket.join(state.code);
      ack?.({ ok: true, state });
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('join_room', (payload: KahootJoinPayload, ack?: (res: unknown) => void) => {
    try {
      const state = rooms.joinRoom(payload.code, socket.id, payload.playerName);
      socket.join(state.code);
      ack?.({ ok: true, state });
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('update_settings', (settings: Partial<KahootRoomSettings>, ack?: (res: unknown) => void) => {
    try {
      const state = rooms.updateSettings(socket.id, settings);
      ack?.({ ok: true, state });
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('start_game', (_payload: unknown, ack?: (res: unknown) => void) => {
    try {
      const state = rooms.startGame(socket.id);
      ack?.({ ok: true, state });
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('submit_answer', (payload: { optionIndex: number }, ack?: (res: unknown) => void) => {
    try {
      const state = rooms.submitAnswer(socket.id, payload.optionIndex);
      ack?.({ ok: true, state });
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('leave_room', () => {
    const { code } = rooms.leaveRoom(socket.id);
    socket.leave(code);
  });

  socket.on('disconnect', () => {
    rooms.leaveRoom(socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`🎮 Kahoot server: http://localhost:${PORT}`);
});
