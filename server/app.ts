import cors from 'cors';
import express, { type Express } from 'express';
import { CONTRACT_VERSION, CONTRACT_VERSION_HEADER } from '../contracts/index';
import type { ServerConfig } from './config/env';
import type { ServerStore } from './db/store';
import { jsonStore } from './db/jsonStore';
import { sqlStore } from './db/sqlStore';
import { asyncHandler } from './middleware/asyncHandler';
import { requestId } from './middleware/requestId';
import { errorHandler } from './middleware/errorHandler';
import { configureRateLimitStore, createRateLimit } from './middleware/rateLimit';
import type { RateLimitStore } from './middleware/rateLimitStore';
import { metrics } from './lib/metrics';
import { createRequireAuthenticated } from './auth/middleware';
import { RoleRegistry } from './authz/roleRegistry';
import {
  createConfigRoleResolver,
  createPersistedRoleResolver,
  type RoleResolver,
} from './authz/roleResolver';
import { createAttachPrincipalRoles } from './authz/principalRoles';
import { createAttachPersistedIdentity } from './authz/principalIdentity';
import { createRoleService, type RoleService } from './authz/roleService';
import { createPolicies } from './authz/policy';
import type { IdentityRepositories } from './domains/identity/repository';
import type { Database } from './infrastructure/database/client';
import { createSqlIdentityRepositories } from './infrastructure/database/repositories/identity';
import { createSqlRateLimitStore } from './infrastructure/database/repositories/rateLimitStore';
import { createAdminRolesRouter } from './routes/adminRoles';
import { createAuditLog, type AuditLog } from './audit';
import { createWalletLedger, type WalletLedger } from './wallet';
import { createIdempotencyStore, type IdempotencyStore } from './lib/idempotency';
import { createMigrationStore, type MigrationStore } from './migration/migrationStore';
import { scriptureRouter } from './routes/scripture';
import { createQuestionsAdminRouter } from './routes/questionsAdmin';
import { createMeRouter } from './routes/me';
import { createProgressionRouter } from './routes/progression';
import { createShopRouter } from './routes/shop';
import { createDemoRouter } from './routes/demo';
import { questionsRouter } from './routes/questions';
import { useQuestionsSql } from './db/pgPool';
import { listKahootSessions, getKahootSession, sessionToCsv } from './kahootSessions';

export interface AppDeps {
  config: ServerConfig;
  dbStore?: ServerStore;
  auditLog?: AuditLog;
  roleRegistry?: RoleRegistry;
  /**
   * Drizzle handle over the shared `pg.Pool` (Phase 2 WS2). When present (or
   * `identity` is given directly) RBAC resolves from the persisted `user_roles`
   * store and the `/api/v1/admin/roles` surface is mounted.
   */
  database?: Database;
  identity?: IdentityRepositories;
  roleResolver?: RoleResolver;
  roleService?: RoleService;
  /**
   * Shared fixed-window rate-limit store (Phase 2 WS2 part 4). Defaults to the
   * Postgres adapter when `database` is set, otherwise the process-wide
   * in-memory store. Installed on the module singleton — the last `createApp`
   * wins, which is fine for the one-app-per-process runtime and matches how
   * tests already `resetRateLimits()`.
   */
  rateLimitStore?: RateLimitStore;
  walletLedger?: WalletLedger;
  idempotency?: IdempotencyStore;
  migrationStore?: MigrationStore;
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
  const walletLedger = deps.walletLedger ?? createWalletLedger(config);
  const idempotency = deps.idempotency ?? createIdempotencyStore(config);
  const migrationStore = deps.migrationStore ?? createMigrationStore(config);

  // --- Shared rate-limit store (Phase 2 WS2 part 4, closes the Phase 1 §13 handoff) ---
  const rateLimitStore =
    deps.rateLimitStore ??
    (deps.database ? createSqlRateLimitStore(deps.database) : undefined);
  if (rateLimitStore) configureRateLimitStore(rateLimitStore);

  // --- RBAC principal resolution (Phase 2 WS2 part 3, closes ADR-011) ---
  const identity =
    deps.identity ?? (deps.database ? createSqlIdentityRepositories(deps.database) : undefined);
  const roleResolver =
    deps.roleResolver ??
    (identity
      ? createPersistedRoleResolver({ roleRepo: identity.roles, floor: roleRegistry })
      : createConfigRoleResolver(roleRegistry));
  const roleService =
    deps.roleService ??
    (identity
      ? createRoleService({
          roleRepo: identity.roles,
          userRepo: identity.users,
          auditLog,
          resolver: roleResolver,
        })
      : undefined);
  const attachPrincipalRoles = createAttachPrincipalRoles(roleResolver);
  // With a persisted store, every authenticated principal is upserted into
  // `users` on first sight so the runtime grant surface can target them (spec
  // §11). Without a store this is a no-op the chain simply omits.
  const attachPersistedIdentity = identity
    ? [createAttachPersistedIdentity(identity.users)]
    : [];
  /** Authenticate, persist the principal (when a store is wired), then resolve roles. */
  const authed = [requireAuthenticated, ...attachPersistedIdentity, attachPrincipalRoles];
  const { requireRole, requirePermission } = createPolicies({ auditLog });

  const rl = (name: string, windowMs: number, max: number) =>
    createRateLimit({ name, windowMs, max, disabled: config.rateLimitDisabled });
  // Coarse per-IP guard that runs before authentication (§13 "auth attempts").
  const rlIp = (name: string, windowMs: number, max: number) =>
    createRateLimit({
      name,
      windowMs,
      max,
      disabled: config.rateLimitDisabled,
      by: (req) => req.ip ?? 'unknown',
    });

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use(cors({ origin: config.clientOrigins, credentials: true }));
  app.use(requestId);
  app.use((_req, res, next) => {
    res.setHeader(CONTRACT_VERSION_HEADER, CONTRACT_VERSION);
    next();
  });

  // --- Health / observability (§16) ---
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/health/live', (_req, res) => res.json({ ok: true }));
  app.get(
    '/health/ready',
    asyncHandler(async (_req, res) => {
      try {
        await dbStore.getStudyAnswers('__health__');
        await walletLedger.getBalance('__health__');
        res.json({ ok: true, provider: config.storageProvider });
      } catch {
        res.status(503).json({ ok: false });
      }
    }),
  );
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
  app.get('/metrics', (_req, res) => res.json(metrics.snapshot()));

  // --- Public content ---
  app.use('/api/scripture', scriptureRouter);
  app.use('/api/questions', questionsRouter);

  // --- Admin (authenticated + permissioned + rate limited, §6.3) ---
  app.use(
    '/api/admin/questions',
    rlIp('admin_ip', 60_000, 60),
    ...authed,
    requirePermission('questions:admin'),
    rl('admin', 60_000, 20),
    createQuestionsAdminRouter({ auditLog, config }),
  );

  // --- Authenticated self-scoped command surface (§5.3, §7) ---
  // A coarse per-IP limiter runs before auth (§13 "auth attempts"); the finer
  // per-principal limits live inside / alongside each router.
  app.use('/api/v1', rlIp('api_v1_ip', 60_000, 120));

  // Runtime RBAC grant/revoke (§9, closes ADR-011) — only with a persisted store.
  if (roleService) {
    app.use(
      '/api/v1/admin/roles',
      rlIp('admin_ip', 60_000, 60),
      ...authed,
      requireRole('admin'),
      rl('admin_roles', 60_000, 30),
      createAdminRolesRouter({ roleService }),
    );
  }

  app.use(
    '/api/v1/me',
    ...authed,
    createMeRouter({ dbStore, walletLedger, migrationStore, auditLog, config }),
  );
  app.use(
    '/api/v1/progression',
    ...authed,
    rl('progression', 60_000, 60),
    createProgressionRouter({ dbStore, walletLedger, idempotency }),
  );
  app.use(
    '/api/v1/shop',
    ...authed,
    rl('shop', 60_000, 15),
    createShopRouter({ dbStore, walletLedger, auditLog, idempotency }),
  );

  // --- Demo/in-memory endpoints — mounted only off-production (§10, §17) ---
  if (config.demoRoutesEnabled) {
    app.use(createDemoRouter());
  }

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
