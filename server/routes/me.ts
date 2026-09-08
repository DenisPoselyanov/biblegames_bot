/**
 * Self-scoped identity routes (Phase 1 §5.3).
 *
 * The user id is always derived from the verified `req.auth` principal — there
 * is no `:userId` path parameter, so cross-user access is structurally
 * impossible. Authentication is enforced by the caller (see server/app.ts).
 *
 * WS4 part 2 removed the legacy `/profile/:userId` routes and the whole-profile
 * `PUT` — these self-scoped routes are the only user-facing profile surface.
 */

import { Router, type Request } from 'express';
import { meContract } from '../../contracts/index';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validate';
import { UnauthorizedError } from '../lib/errors';
import { createRateLimit } from '../middleware/rateLimit';
import type { ServerConfig } from '../config/env';
import type { ServerStore } from '../db/store';
import type { WalletLedger } from '../wallet';
import type { AuditLog } from '../audit';
import { buildAuditRecord } from '../audit';
import type { MigrationStore } from '../migration/migrationStore';
import { applyMigration } from '../migration/applyMigration';
import { readProfile, writePreferences, writeLearningState } from '../services/profileService';
import {
  sanitizeStatsBody,
  sanitizeStudyAnswers,
  sanitizeTelemetryEvents,
} from '../middleware/validateBody';

export interface MeRouterDeps {
  dbStore: ServerStore;
  walletLedger: WalletLedger;
  migrationStore: MigrationStore;
  auditLog: AuditLog;
  config: ServerConfig;
}

function requirePrincipal(req: Request) {
  if (!req.auth) {
    throw new UnauthorizedError('missing_credentials', 'Authentication required');
  }
  return req.auth;
}

export function createMeRouter({
  dbStore,
  walletLedger,
  migrationStore,
  auditLog,
  config,
}: MeRouterDeps): Router {
  const router = Router();
  const rl = (name: string, windowMs: number, max: number) =>
    createRateLimit({ name, windowMs, max, disabled: config.rateLimitDisabled });

  router.get('/', (req, res) => {
    const principal = requirePrincipal(req);
    // Resolved upstream by `attachPrincipalRoles` (server/authz/principalRoles.ts).
    const { roles = ['user'], permissions = [] } = req.authz ?? {};
    res.json({
      userId: principal.userId,
      displayName: principal.displayName,
      username: principal.username,
      languageCode: principal.languageCode,
      authSource: principal.authSource,
      roles,
      permissions,
    });
  });

  router.get(
    '/profile',
    asyncHandler(async (req, res) => {
      const { userId } = requirePrincipal(req);
      res.json(await readProfile(dbStore, userId, walletLedger));
    }),
  );

  router.patch(
    '/preferences',
    rl('me_preferences', 60_000, 20),
    validateBody(meContract.preferencesRequest, 'invalid_preferences'),
    asyncHandler(async (req, res) => {
      const { userId } = requirePrincipal(req);
      await writePreferences(dbStore, userId, req.body);
      res.json(await readProfile(dbStore, userId, walletLedger));
    }),
  );

  // Client-owned review-schedule blob (§7.4 tracked exception — see profileService).
  router.patch(
    '/learning-state',
    rl('me_preferences', 60_000, 20),
    validateBody(meContract.learningStateRequest, 'invalid_learning_state'),
    asyncHandler(async (req, res) => {
      const { userId } = requirePrincipal(req);
      const reviewSchedules = await writeLearningState(dbStore, userId, req.body);
      res.json({ ok: true, reviewSchedules });
    }),
  );

  router.post(
    '/migrate',
    rl('me_migrate', 300_000, 3),
    asyncHandler(async (req, res) => {
      const { userId } = requirePrincipal(req);
      const { record, replayed } = await applyMigration(userId, req.body ?? {}, {
        dbStore,
        walletLedger,
        migrationStore,
        config,
      });
      if (!replayed) {
        await auditLog.append(
          buildAuditRecord({
            actor: { userId, authSource: req.auth?.authSource ?? null },
            action: 'migration.claim',
            target: userId,
            result: 'ok',
            requestId: req.id,
            metadata: {
              status: record.status,
              sourceVersion: record.sourceVersion,
              acceptedCoins: (record.accepted as { coins?: number }).coins,
            },
          }),
        );
      }
      res.status(replayed ? 200 : 201).json({ ok: true, replayed, record });
    }),
  );

  router.get(
    '/stats',
    asyncHandler(async (req, res) => {
      const { userId } = requirePrincipal(req);
      const stats = await dbStore.getStats(userId);
      res.json(stats ?? { themes: {}, lastUpdated: new Date().toISOString() });
    }),
  );

  router.put(
    '/stats',
    asyncHandler(async (req, res) => {
      const { userId } = requirePrincipal(req);
      await dbStore.setStats(userId, sanitizeStatsBody(userId, req.body));
      res.json({ ok: true });
    }),
  );

  router.get(
    '/study/answers',
    asyncHandler(async (req, res) => {
      const { userId } = requirePrincipal(req);
      res.json(await dbStore.getStudyAnswers(userId));
    }),
  );

  router.put(
    '/study/answers',
    asyncHandler(async (req, res) => {
      const { userId } = requirePrincipal(req);
      await dbStore.setStudyAnswers(userId, sanitizeStudyAnswers(req.body));
      res.json({ ok: true });
    }),
  );

  router.post(
    '/telemetry',
    rl('me_telemetry', 60_000, 30),
    asyncHandler(async (req, res) => {
      const { userId } = requirePrincipal(req);
      const events = sanitizeTelemetryEvents(req.body);
      await dbStore.appendTelemetry(userId, events);
      res.json({ ok: true, accepted: events.length });
    }),
  );

  return router;
}
