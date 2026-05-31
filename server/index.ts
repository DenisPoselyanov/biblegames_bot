import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type { KahootCreatePayload, KahootJoinPayload, KahootRoomSettings } from '../src/types/kahoot';
import { RoomManager } from './roomManager';
import { saveKahootSession, listKahootSessions, getKahootSession, sessionToCsv } from './kahootSessions';
import { jsonStore } from './db/jsonStore';
import { sqlStore } from './db/sqlStore';
import type { ServerStore } from './db/store';
import { asyncHandler } from './middleware/asyncHandler';
import { telegramAuthMiddleware } from './middleware/telegramAuth';
import {
  sanitizeProfileBody,
  sanitizeStatsBody,
  sanitizeStudyAnswers,
  sanitizeTelemetryEvents,
} from './middleware/validateBody';
import { loadFullQuestionPool } from './questionPool';
import { scriptureRouter } from './routes/scripture';

const PORT = Number(process.env.PORT || 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'json';
const dbStore: ServerStore = STORAGE_PROVIDER === 'sql' ? sqlStore : jsonStore;

loadFullQuestionPool();

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: [CLIENT_ORIGIN, 'http://127.0.0.1:5173'], credentials: true }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/scripture', scriptureRouter);

app.get(
  '/health/storage',
  asyncHandler(async (_req, res) => {
    await dbStore.getStudyAnswers('__health__');
    res.json({ ok: true, provider: STORAGE_PROVIDER });
  }),
);

const studyAnswers: Array<Record<string, unknown>> = [];
const dailyCompletions: Array<Record<string, unknown>> = [];

const protectedRouter = express.Router();
const withTelegramAuth = [telegramAuthMiddleware];

protectedRouter.get('/study/answers/:userId', ...withTelegramAuth, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (req.header('x-user-id') !== userId) {
    res.status(403).json({ error: 'forbidden_user_scope' });
    return;
  }
  res.json(await dbStore.getStudyAnswers(userId));
}));

protectedRouter.put('/study/answers/:userId', ...withTelegramAuth, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (req.header('x-user-id') !== userId) {
    res.status(403).json({ error: 'forbidden_user_scope' });
    return;
  }
  const list = sanitizeStudyAnswers(req.body);
  await dbStore.setStudyAnswers(userId, list);
  res.json({ ok: true });
}));

protectedRouter.get('/stats/:userId', ...withTelegramAuth, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (req.header('x-user-id') !== userId) {
    res.status(403).json({ error: 'forbidden_user_scope' });
    return;
  }
  const stats = await dbStore.getStats(userId);
  if (!stats) {
    res.json({
      themes: {},
      lastUpdated: new Date().toISOString(),
    });
    return;
  }
  res.json(stats);
}));

protectedRouter.put('/stats/:userId', ...withTelegramAuth, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (req.header('x-user-id') !== userId) {
    res.status(403).json({ error: 'forbidden_user_scope' });
    return;
  }
  await dbStore.setStats(userId, sanitizeStatsBody(userId, req.body));
  res.json({ ok: true });
}));

protectedRouter.get('/profile/:userId', ...withTelegramAuth, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (req.header('x-user-id') !== userId) {
    res.status(403).json({ error: 'forbidden_user_scope' });
    return;
  }
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
      bibleTranslation: 'UTT',
    });
    return;
  }
  res.json(profile);
}));

protectedRouter.put('/profile/:userId', ...withTelegramAuth, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (req.header('x-user-id') !== userId) {
    res.status(403).json({ error: 'forbidden_user_scope' });
    return;
  }
  const existing = (await dbStore.getProfile(userId)) ?? {};
  const sanitized = sanitizeProfileBody(userId, req.body);
  await dbStore.setProfile(userId, {
    ...existing,
    ...sanitized,
    userId,
    updatedAt: new Date().toISOString(),
  });
  res.json({ ok: true });
}));

protectedRouter.post('/telemetry/:userId', ...withTelegramAuth, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (req.header('x-user-id') !== userId) {
    res.status(403).json({ error: 'forbidden_user_scope' });
    return;
  }
  const events = sanitizeTelemetryEvents(req.body);
  await dbStore.appendTelemetry(userId, events);
  res.json({ ok: true, accepted: events.length });
}));

app.use(protectedRouter);

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

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [CLIENT_ORIGIN, 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
  },
});

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

app.get(
  '/api/kahoot/sessions',
  asyncHandler(async (_req, res) => {
    res.json({ sessions: listKahootSessions(50) });
  }),
);

app.get(
  '/api/kahoot/sessions/:id/csv',
  asyncHandler(async (req, res) => {
    const session = getKahootSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="kahoot-${session.code}.csv"`);
    res.send(sessionToCsv(session));
  }),
);

io.on('connection', (socket) => {
  socket.on('create_room', (payload: KahootCreatePayload, ack?: (res: unknown) => void) => {
    try {
      const state = rooms.createRoom(
        socket.id,
        payload.hostName,
        payload.settings,
        payload.hostTelegramId,
      );
      socket.join(state.code);
      ack?.({ ok: true, state });
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('join_room', (payload: KahootJoinPayload, ack?: (res: unknown) => void) => {
    try {
      const state = rooms.joinRoom(payload.code, socket.id, payload.playerName, payload.customField);
      socket.join(state.code);
      ack?.({ ok: true, state });
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('rejoin_room', (payload: KahootJoinPayload, ack?: (res: unknown) => void) => {
    try {
      const state = rooms.rejoinRoom(payload.code, socket.id, payload.playerName);
      socket.join(state.code);
      ack?.({ ok: true, state });
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('join_as_display', (payload: { code: string }, ack?: (res: unknown) => void) => {
    try {
      const state = rooms.joinAsDisplay(payload.code, socket.id);
      socket.join(state.code.toUpperCase());
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
      const optionIndex = Number(payload?.optionIndex);
      const state = rooms.submitAnswer(socket.id, optionIndex);
      ack?.({ ok: true, state });
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('advance_phase', (_payload: unknown, ack?: (res: unknown) => void) => {
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

app.use((err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

httpServer.listen(PORT, () => {
  console.log(`🎮 Kahoot server: http://localhost:${PORT}`);
});

httpServer.on('error', (err) => {
  console.error('HTTP server error:', err);
});
