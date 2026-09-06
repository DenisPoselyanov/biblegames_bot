import cors from 'cors';
import express, { type Express, type Request } from 'express';
import type { ServerConfig } from './config/env';
import type { ServerStore } from './db/store';
import { jsonStore } from './db/jsonStore';
import { sqlStore } from './db/sqlStore';
import { asyncHandler } from './middleware/asyncHandler';
import { requestId } from './middleware/requestId';
import { errorHandler } from './middleware/errorHandler';
import { ForbiddenError } from './lib/errors';
import { createRequireAuthenticated } from './auth/middleware';
import { RoleRegistry } from './authz/roleRegistry';
import { createPolicies } from './authz/policy';
import { createAuditLog, type AuditLog } from './audit';
import {
  sanitizeStatsBody,
  sanitizeStudyAnswers,
  sanitizeTelemetryEvents,
} from './middleware/validateBody';
import { readProfile, writeProfile } from './services/profileService';
import { scriptureRouter } from './routes/scripture';
import { createQuestionsAdminRouter } from './routes/questionsAdmin';
import { createMeRouter } from './routes/me';
import { questionsRouter } from './routes/questions';
import { useQuestionsSql } from './db/pgPool';
import { listKahootSessions, getKahootSession, sessionToCsv } from './kahootSessions';

export interface AppDeps {
  config: ServerConfig;
  dbStore?: ServerStore;
  auditLog?: AuditLog;
  roleRegistry?: RoleRegistry;
}

function assertSelf(req: Request, userId: string): void {
  // `req.auth` is the authoritative identity under authV2. When the `authV2`
  // break-glass flag is off the legacy middleware runs instead and sets no
  // principal, so fall back to the (insecure) header it validated.
  const selfId = req.auth?.userId ?? req.header('x-user-id');
  if (selfId !== userId) {
    throw new ForbiddenError('forbidden_user_scope', "Cannot access another user's data");
  }
}

/**
 * Builds the Express app with no `listen` and no Socket.IO, so integration tests
 * can drive it directly (Phase 1 §10). Realtime wiring lives in index.ts.
 */
export function createApp(deps: AppDeps): Express {
  const { config } = deps;
  const dbStore: ServerStore =
    deps.dbStore ?? (config.storageProvider === 'sql' ? sqlStore : jsonStore);
  const requireAuthenticated = createRequireAuthenticated(config);
  const roleRegistry = deps.roleRegistry ?? new RoleRegistry(config.roleGrants);
  const auditLog = deps.auditLog ?? createAuditLog(config);
  const { requirePermission } = createPolicies({ roleRegistry, auditLog });

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(cors({ origin: config.clientOrigins, credentials: true }));
  app.use(requestId);

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/scripture', scriptureRouter);
  app.use('/api/questions', questionsRouter);
  app.use(
    '/api/admin/questions',
    requireAuthenticated,
    requirePermission('questions:admin'),
    createQuestionsAdminRouter({ auditLog, config }),
  );
  app.use('/api/v1/me', requireAuthenticated, createMeRouter({ dbStore, roleRegistry }));

  app.get(
    '/health/storage',
    asyncHandler(async (_req, res) => {
      await dbStore.getStudyAnswers('__health__');
      res.json({
        ok: true,
        provider: config.storageProvider,
        questionsProvider: useQuestionsSql() ? 'sql' : 'json',
      });
    }),
  );

  // --- Demo/in-memory endpoints (WS4 removes or isolates these) ---
  const studyAnswers: Array<Record<string, unknown>> = [];
  const dailyCompletions: Array<Record<string, unknown>> = [];

  // --- Authenticated self-scoped routes ---
  const protectedRouter = express.Router();

  protectedRouter.get(
    '/study/answers/:userId',
    requireAuthenticated,
    asyncHandler(async (req, res) => {
      assertSelf(req, req.params.userId);
      res.json(await dbStore.getStudyAnswers(req.params.userId));
    }),
  );

  protectedRouter.put(
    '/study/answers/:userId',
    requireAuthenticated,
    asyncHandler(async (req, res) => {
      assertSelf(req, req.params.userId);
      await dbStore.setStudyAnswers(req.params.userId, sanitizeStudyAnswers(req.body));
      res.json({ ok: true });
    }),
  );

  protectedRouter.get(
    '/stats/:userId',
    requireAuthenticated,
    asyncHandler(async (req, res) => {
      assertSelf(req, req.params.userId);
      const stats = await dbStore.getStats(req.params.userId);
      res.json(stats ?? { themes: {}, lastUpdated: new Date().toISOString() });
    }),
  );

  protectedRouter.put(
    '/stats/:userId',
    requireAuthenticated,
    asyncHandler(async (req, res) => {
      assertSelf(req, req.params.userId);
      await dbStore.setStats(req.params.userId, sanitizeStatsBody(req.params.userId, req.body));
      res.json({ ok: true });
    }),
  );

  protectedRouter.get(
    '/profile/:userId',
    requireAuthenticated,
    asyncHandler(async (req, res) => {
      assertSelf(req, req.params.userId);
      res.json(await readProfile(dbStore, req.params.userId));
    }),
  );

  protectedRouter.put(
    '/profile/:userId',
    requireAuthenticated,
    asyncHandler(async (req, res) => {
      assertSelf(req, req.params.userId);
      await writeProfile(dbStore, req.params.userId, req.body);
      res.json({ ok: true });
    }),
  );

  protectedRouter.post(
    '/telemetry/:userId',
    requireAuthenticated,
    asyncHandler(async (req, res) => {
      assertSelf(req, req.params.userId);
      const events = sanitizeTelemetryEvents(req.body);
      await dbStore.appendTelemetry(req.params.userId, events);
      res.json({ ok: true, accepted: events.length });
    }),
  );

  app.use(protectedRouter);

  // --- Demo endpoints (unauthenticated, in-memory) ---
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

  // --- Kahoot session export (HTTP only, no realtime dependency) ---
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

  app.use(errorHandler);

  return app;
}
