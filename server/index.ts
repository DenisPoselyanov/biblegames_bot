import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type { KahootCreatePayload, KahootJoinPayload, KahootRoomSettings } from '../src/types/kahoot';
import { RoomManager } from './roomManager';
import { jsonStore } from './db/jsonStore';
import { sqlStore } from './db/sqlStore';
import type { ServerStore } from './db/store';

const PORT = Number(process.env.PORT || 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'json';
const dbStore: ServerStore = STORAGE_PROVIDER === 'sql' ? sqlStore : jsonStore;

const app = express();
app.use(express.json());
app.use(cors({ origin: [CLIENT_ORIGIN, 'http://127.0.0.1:5173'], credentials: true }));
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/health/storage', async (_req, res) => {
  try {
    await dbStore.getStudyAnswers('__health__');
    res.json({ ok: true, provider: STORAGE_PROVIDER });
  } catch (error) {
    res.status(500).json({
      ok: false,
      provider: STORAGE_PROVIDER,
      error: error instanceof Error ? error.message : 'storage_error',
    });
  }
});

const studyAnswers: Array<Record<string, unknown>> = [];
const dailyCompletions: Array<Record<string, unknown>> = [];

function verifyUserScope(req: express.Request, res: express.Response, userId: string): boolean {
  const authUserId = req.header('x-user-id');
  if (!authUserId) {
    res.status(401).json({ error: 'missing_user_header' });
    return false;
  }
  if (authUserId !== userId) {
    res.status(403).json({ error: 'forbidden_user_scope' });
    return false;
  }
  return true;
}

app.get('/study/path', (_req, res) => {
  res.json({
    generatedAt: new Date().toISOString(),
    nodes: [
      { subthemeId: 'gospels-life', priority: 92, reason: 'weakness' },
      { subthemeId: 'sinai-law', priority: 74, reason: 'scheduled-review' },
      { subthemeId: 'bible-geography', priority: 68, reason: 'new' },
    ],
  });
});

app.post('/study/answer', (req, res) => {
  studyAnswers.push({ ...req.body, createdAt: new Date().toISOString() });
  res.json({ ok: true });
});

app.get('/study/answers/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!verifyUserScope(req, res, userId)) return;
  res.json(await dbStore.getStudyAnswers(userId));
});

app.put('/study/answers/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!verifyUserScope(req, res, userId)) return;
  const list = Array.isArray(req.body) ? req.body : [];
  await dbStore.setStudyAnswers(userId, list);
  res.json({ ok: true });
});

app.post('/daily/complete', (req, res) => {
  dailyCompletions.push({ ...req.body, createdAt: new Date().toISOString() });
  res.json({ ok: true });
});

app.get('/dashboard', (_req, res) => {
  res.json({
    streakDays: 0,
    todaysGoal: 'Пройти 2 рівні в Дослідженні',
    completedToday: dailyCompletions.length,
    answeredToday: studyAnswers.length,
  });
});

app.get('/leaderboard', (_req, res) => {
  res.json({
    items: [
      { userId: 'u1', displayName: 'Аполлос', points: 2420 },
      { userId: 'u2', displayName: 'Мойсей', points: 2180 },
      { userId: 'u3', displayName: 'Маріам', points: 1740 },
    ],
  });
});

app.get('/stats/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!verifyUserScope(req, res, userId)) return;
  const stats = await dbStore.getStats(userId);
  if (!stats) {
    res.json({
      themes: {},
      lastUpdated: new Date().toISOString(),
    });
    return;
  }
  res.json(stats);
});

app.put('/stats/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!verifyUserScope(req, res, userId)) return;
  await dbStore.setStats(userId, { ...req.body, userId, updatedAt: new Date().toISOString() });
  res.json({ ok: true });
});

app.get('/profile/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!verifyUserScope(req, res, userId)) return;
  const profile = await dbStore.getProfile(userId);
  if (!profile) {
    res.json({
      userId,
      displayName: '',
      totalPoints: 0,
      themePoints: {},
      completedLevels: [],
      survivalHighScore: 0,
      millionaireWins: 0,
      millionaireMaxLevel: 0,
      unlockedThemes: [],
      activeTheme: '',
      achievements: [],
      avatar: '',
      coins: 0,
      unlockedAvatars: [],
      streakDays: 0,
      lastActiveAt: null,
      studyMastery: {},
    });
    return;
  }
  res.json(profile);
});

app.put('/profile/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!verifyUserScope(req, res, userId)) return;
  await dbStore.setProfile(userId, { ...req.body, userId, updatedAt: new Date().toISOString() });
  res.json({ ok: true });
});

app.post('/telemetry/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!verifyUserScope(req, res, userId)) return;
  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  await dbStore.appendTelemetry(userId, events);
  res.json({ ok: true, accepted: events.length });
});

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
