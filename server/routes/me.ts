/**
 * Self-scoped identity routes (Phase 1 §5.3).
 *
 * The user id is always derived from the verified `req.auth` principal — there
 * is no `:userId` path parameter, so cross-user access is structurally
 * impossible. Authentication is enforced by the caller (see server/app.ts).
 *
 * These run alongside the legacy `/profile/:userId` etc. routes during Phase 1;
 * WS4 removes the legacy ones.
 */

import { Router, type Request } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { UnauthorizedError } from '../lib/errors';
import type { ServerStore } from '../db/store';
import type { RoleRegistry } from '../authz/roleRegistry';
import { readProfile, writeProfile } from '../services/profileService';
import {
  sanitizeStatsBody,
  sanitizeStudyAnswers,
  sanitizeTelemetryEvents,
} from '../middleware/validateBody';

export interface MeRouterDeps {
  dbStore: ServerStore;
  roleRegistry: RoleRegistry;
}

function requirePrincipal(req: Request) {
  if (!req.auth) {
    throw new UnauthorizedError('missing_credentials', 'Authentication required');
  }
  return req.auth;
}

export function createMeRouter({ dbStore, roleRegistry }: MeRouterDeps): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const principal = requirePrincipal(req);
    const { roles, permissions } = roleRegistry.describe(principal.userId);
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
      res.json(await readProfile(dbStore, userId));
    }),
  );

  router.put(
    '/profile',
    asyncHandler(async (req, res) => {
      const { userId } = requirePrincipal(req);
      await writeProfile(dbStore, userId, req.body);
      res.json({ ok: true });
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
    asyncHandler(async (req, res) => {
      const { userId } = requirePrincipal(req);
      const events = sanitizeTelemetryEvents(req.body);
      await dbStore.appendTelemetry(userId, events);
      res.json({ ok: true, accepted: events.length });
    }),
  );

  return router;
}
