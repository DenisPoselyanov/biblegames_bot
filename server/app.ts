import cors from 'cors';
import express, { type Express } from 'express';
import { CONTRACT_VERSION, CONTRACT_VERSION_HEADER } from '../contracts/index';
import type { ServerConfig } from './config/env';
import type { ServerStore } from './db/store';
import { jsonStore } from './db/jsonStore';
import { sqlStore } from './db/sqlStore';
import { asyncHandler } from './middleware/asyncHandler';
import { requestId } from './middleware/requestId';
import { httpMetrics } from './middleware/httpMetrics';
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
import { createSqlProgressionRepositories } from './infrastructure/database/repositories/progression';
import { createSqlEconomyRepositories } from './infrastructure/database/repositories/economy';
import { createSqlRateLimitStore } from './infrastructure/database/repositories/rateLimitStore';
import { createSqlContentRepositories } from './infrastructure/database/repositories/content';
import { createSqlLearningRepositories } from './infrastructure/database/repositories/learning';
import { createProgressionService } from './services/progressionService';
import { createLearningService } from './services/learningService';
import { createLegacyBlobMirror } from './services/legacyBlobMirror';
import type { ProgressionCutover } from './services/profileService';
import { createContentQueryService } from './services/contentQuery';
import { configureCanonicalContent } from './services/questionService';
import type { ContentRepositories } from './domains/content/repository';
import { createAdminRolesRouter } from './routes/adminRoles';
import { createAuditLog, type AuditLog } from './audit';
import { createWalletLedger, createSqlWalletLedger, type WalletLedger } from './wallet';
import { createIdempotencyStore, type IdempotencyStore } from './lib/idempotency';
import { createMigrationStore, type MigrationStore } from './migration/migrationStore';
import { scriptureRouter } from './routes/scripture';
import { createQuestionsAdminRouter } from './routes/questionsAdmin';
import { buildStudioSettings, createStudioRouter } from './routes/studio';
import { createStudioLibraryRouter, createStudioReleasesRouter } from './routes/studioLibrary';
import { createStudioReviewRouter, type StudioReviewRepositories } from './routes/studioReview';
import { createSqlValidationFindingRepository } from './infrastructure/database/repositories/validationFindings';
import { createSqlQualityRepositories } from './infrastructure/database/repositories/quality';
import type { QualityRepositories } from './domains/quality/repository';
import { createContentReportsRouter } from './routes/contentReports';
import { createStudioQualityRouter } from './routes/studioQuality';
import { createStudioAssessmentsRouter } from './routes/studioAssessments';
import type { GoldenSample } from './domains/quality/goldenSample';
import { createSqlScriptureEvidenceRepository } from './infrastructure/database/repositories/scriptureEvidence';
import type { JobQueue } from './domains/jobs/queue';
import { createClientErrorsRouter } from './routes/clientErrors';
import { createMeRouter } from './routes/me';
import { createProgressionRouter } from './routes/progression';
import { createLearningRouter } from './routes/learning';
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
  /**
   * Canonical content repositories (Phase 2 WS3). Defaults to the SQL adapter
   * when `database` is set. The `canonicalContentRepository` config mode decides
   * whether the question read path stays on the legacy bank (`off`), compares
   * (`compare`), or serves published revisions (`canonical`).
   */
  contentRepositories?: ContentRepositories;
  /**
   * A job queue instance running in THIS process (Phase 4 WS8a). Absent by
   * default in production — jobs run in the separate worker deployable
   * (Phase 2 §17, `server/worker.ts`), which has its own in-memory `Map` no
   * HTTP request can see. Pass one (e.g. in tests, or a single-process
   * deployment that also calls `queue.start()`) to power the Studio Jobs
   * screen with live data; without it, `/api/v1/studio/jobs*` reports
   * `available: false` instead of a fabricated empty list.
   */
  jobQueue?: JobQueue;
  /**
   * Revision/finding/evidence repositories for the Studio review queue (Phase
   * 4 WS8b). Defaults to the SQL adapters when a database is wired; tests
   * inject in-memory peers. Without either, `/api/v1/studio/review*` reports
   * `available: false`.
   */
  studioReview?: StudioReviewRepositories;
  /**
   * Content-quality signals + player reports (Phase 4 WS9). Defaults to the SQL
   * adapters with a database; tests inject in-memory peers. Without either,
   * reports answer 503 and the Studio quality screen reports `available: false`.
   */
  quality?: QualityRepositories;
  /** The committed golden sample (content quality gate). Defaults to `data/quality/golden-sample.json`; tests inject one. */
  goldenSample?: () => GoldenSample | null;
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
  // With a database wired, the wallet runs on the shared Drizzle handle so a
  // reward's ledger row can join the progression transaction (ADR-016).
  const walletLedger =
    deps.walletLedger ??
    (deps.database ? createSqlWalletLedger(deps.database) : createWalletLedger(config));
  const idempotency = deps.idempotency ?? createIdempotencyStore(config);
  const migrationStore = deps.migrationStore ?? createMigrationStore(config);

  // --- Shared rate-limit store (Phase 2 WS2 part 4, closes the Phase 1 §13 handoff) ---
  const rateLimitStore =
    deps.rateLimitStore ??
    (deps.database ? createSqlRateLimitStore(deps.database) : undefined);
  if (rateLimitStore) configureRateLimitStore(rateLimitStore);

  // --- Canonical content repository (Phase 2 WS3 part 3, §14) ---
  const contentRepositories =
    deps.contentRepositories ??
    (deps.database ? createSqlContentRepositories(deps.database) : undefined);
  configureCanonicalContent(
    contentRepositories && config.canonicalContentRepository !== 'off'
      ? {
          mode: config.canonicalContentRepository,
          query: createContentQueryService(contentRepositories),
        }
      : null,
  );

  // --- RBAC principal resolution (Phase 2 WS2 part 3, closes ADR-011) ---
  const identity =
    deps.identity ?? (deps.database ? createSqlIdentityRepositories(deps.database) : undefined);

  // Typed-preferences cutover (Phase 2 §18.2) — active whenever identity is
  // wired. Shared by `/me/preferences` (writes) and `/shop/purchases` (auto-equip).
  const preferencesCutover = identity
    ? { repo: identity.preferences, legacyReadOnly: config.legacyStoreReadOnly }
    : undefined;

  // Progression / entitlement decomposition cutover (Phase 2 §18.2, ADR-016) —
  // SQL-only, active whenever a database is wired. `progressionCutover` powers the
  // `readProfile` overlay; `progressionService` is the transactional write path.
  const progressionRepos = deps.database
    ? createSqlProgressionRepositories(deps.database)
    : undefined;
  const economyRepos = deps.database ? createSqlEconomyRepositories(deps.database) : undefined;
  const progressionCutover: ProgressionCutover | undefined =
    progressionRepos && economyRepos
      ? {
          repos: progressionRepos,
          entitlements: economyRepos.entitlements,
          legacyReadOnly: config.legacyProgressionReadOnly,
          now: () => new Date(),
        }
      : undefined;
  const progressionService =
    deps.database && progressionRepos && economyRepos
      ? createProgressionService({
          db: deps.database,
          repos: progressionRepos,
          entitlements: economyRepos.entitlements,
          walletLedger,
          legacyBlobMirror: createLegacyBlobMirror(),
          legacyReadOnly: config.legacyProgressionReadOnly,
          now: () => new Date(),
        })
      : undefined;

  // --- Learning domain (Phase 3 WS2) — SQL-only, like the RBAC admin surface
  // below: there is no legacy-blob equivalent for lesson/practice content, so
  // the whole surface is simply absent without a database. ---
  const learningRepos = deps.database ? createSqlLearningRepositories(deps.database) : undefined;
  const quality: QualityRepositories | undefined =
    deps.quality ?? (deps.database ? createSqlQualityRepositories(deps.database) : undefined);
  const learningService = deps.database && learningRepos
    ? createLearningService({
        learningRepos,
        contentRepositories,
        dbStore,
        walletLedger,
        preferences: preferencesCutover,
        progression: progressionCutover,
        progressionService,
        questionSignals: quality?.signals,
      })
    : undefined;
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
  app.use(httpMetrics);
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

  // Frontend error reporting (§20) — unauthenticated, tightly IP-limited.
  app.use(
    '/api/v1/client-errors',
    rlIp('client_errors_ip', 60_000, 30),
    createClientErrorsRouter(),
  );

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

  // --- Content Studio review queue/editor (Phase 4 WS8b) — writes gated per action inside.
  // Mounted before the generic `/api/v1/studio` router so a review request runs one
  // auth + rate-limit chain, not both. ---
  const studioReview: StudioReviewRepositories | undefined =
    deps.studioReview ??
    (deps.database && contentRepositories && learningRepos
      ? {
          content: contentRepositories,
          learning: learningRepos,
          findings: createSqlValidationFindingRepository(deps.database),
          scripture: createSqlScriptureEvidenceRepository(deps.database),
        }
      : undefined);
  app.use(
    '/api/v1/studio/review',
    ...authed,
    requirePermission('content:audit:read'),
    rl('studio_review', 60_000, 60),
    createStudioReviewRouter({ auditLog, review: studioReview, requirePermission }),
  );

  // --- Content quality feedback loop (Phase 4 WS9) — player reports + Studio signals. ---
  app.use(
    '/api/v1/content-reports',
    ...authed,
    rl('content_reports', 60_000, 10),
    createContentReportsRouter({ auditLog, reports: quality?.reports, content: studioReview?.content ?? contentRepositories }),
  );
  app.use(
    '/api/v1/studio/quality',
    ...authed,
    requirePermission('content:audit:read'),
    rl('studio_quality', 60_000, 60),
    createStudioQualityRouter({
      auditLog,
      quality,
      review: studioReview,
      jobQueue: deps.jobQueue,
      requirePermission,
    }),
  );

  // --- Content quality gate (WS11c/d) — golden labels, AI verdicts, review decisions. ---
  app.use(
    '/api/v1/studio/assessments',
    ...authed,
    requirePermission('content:audit:read'),
    rl('studio_assessments', 60_000, 120),
    createStudioAssessmentsRouter({
      auditLog,
      quality,
      requirePermission,
      loadGoldenSample: deps.goldenSample,
      jobQueue: deps.jobQueue,
    }),
  );

  // --- Content Studio library + releases (Phase 4 WS8c) — own prefixes, so each
  // request still runs exactly one auth + rate-limit chain; rollback gated inside. ---
  app.use(
    '/api/v1/studio/library',
    ...authed,
    requirePermission('content:audit:read'),
    rl('studio_library', 60_000, 60),
    createStudioLibraryRouter({ review: studioReview }),
  );
  app.use(
    '/api/v1/studio/releases',
    ...authed,
    requirePermission('content:audit:read'),
    rl('studio_releases', 60_000, 60),
    createStudioReleasesRouter({ auditLog, review: studioReview, requirePermission }),
  );

  // --- Content Studio (Phase 4 WS8a) — any content role may read; cancel needs content:ai:run ---
  app.use(
    '/api/v1/studio',
    ...authed,
    requirePermission('content:audit:read'),
    rl('studio', 60_000, 60),
    createStudioRouter({
      auditLog,
      jobQueue: deps.jobQueue,
      aiJobBudget: config.aiJobBudget,
      requireAiRun: requirePermission('content:ai:run'),
      settings: buildStudioSettings(config),
    }),
  );

  app.use(
    '/api/v1/me',
    ...authed,
    createMeRouter({
      dbStore,
      walletLedger,
      migrationStore,
      auditLog,
      config,
      preferences: preferencesCutover,
      progression: progressionCutover,
    }),
  );
  app.use(
    '/api/v1/progression',
    ...authed,
    rl('progression', 60_000, 60),
    createProgressionRouter({ dbStore, walletLedger, idempotency, service: progressionService }),
  );
  if (learningService) {
    app.use(
      '/api/v1/learning',
      ...authed,
      rl('learning', 60_000, 60),
      createLearningRouter({ service: learningService, idempotency }),
    );
  }
  app.use(
    '/api/v1/shop',
    ...authed,
    rl('shop', 60_000, 15),
    createShopRouter({
      dbStore,
      walletLedger,
      auditLog,
      idempotency,
      preferences: preferencesCutover,
      progression: progressionCutover,
      db: deps.database,
    }),
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
