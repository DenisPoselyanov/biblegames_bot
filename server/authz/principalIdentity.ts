/**
 * `attachPersistedIdentity` — the request-path step that makes an authenticated
 * principal a first-class row in the persisted identity store (Phase 2 WS2,
 * spec §11 `IdentityService.resolveTelegramUser` / §10 `createFromTelegram`).
 *
 * Runs in the authenticated chain just before `attachPrincipalRoles`, and ONLY
 * when a persisted identity store is wired (the SQL adapter). It upserts the
 * `users` row plus the `external_identities` binding from `req.auth`, so that:
 *
 *   - the runtime grant surface (`roleService.grant` → `requireUser`) can target
 *     anyone who has signed in at least once — without this step `users` stays
 *     empty in production and every grant 404s;
 *   - `user_roles.user_id` always has a real FK target.
 *
 * Idempotent and best-effort: a short-lived per-process "seen" cache keeps the
 * write off the hot path, and a store failure is logged + swallowed — auth still
 * succeeds and role resolution degrades to the config floor downstream (never a
 * 5xx, never an escalation).
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { log } from '../lib/logger';
import { metrics } from '../lib/metrics';
import type { UserRepository } from '../domains/identity/repository';

export interface AttachPersistedIdentityOptions {
  /** Injectable clock (tests). */
  now?: () => number;
  /** How long a successful upsert suppresses re-writes for the same user. Default 1h. */
  ttlMs?: number;
  /** Sweep expired "seen" entries once the map grows past this. Default 10k. */
  sweepThreshold?: number;
}

export function createAttachPersistedIdentity(
  userRepo: UserRepository,
  { now = Date.now, ttlMs = 3_600_000, sweepThreshold = 10_000 }: AttachPersistedIdentityOptions = {},
): RequestHandler {
  /** userId -> epoch ms after which the user should be re-upserted. */
  const seen = new Map<string, number>();

  return function attachPersistedIdentity(req: Request, _res: Response, next: NextFunction): void {
    const auth = req.auth;
    if (!auth) {
      next();
      return;
    }

    const nowMs = now();
    const freshUntil = seen.get(auth.userId);
    if (freshUntil !== undefined && freshUntil > nowMs) {
      next();
      return;
    }

    if (seen.size > sweepThreshold) {
      for (const [id, exp] of seen) if (exp <= nowMs) seen.delete(id);
    }

    userRepo
      .upsertFromIdentity(
        {
          id: auth.userId,
          displayName: auth.displayName,
          username: auth.username ?? null,
          languageCode: auth.languageCode ?? null,
        },
        // `AuthenticatedPrincipal.authSource` and `IdentityProvider` share the
        // same `'telegram' | 'development'` union — the account source.
        { provider: auth.authSource, externalId: auth.telegramUserId },
      )
      .then(
        () => {
          seen.set(auth.userId, nowMs + ttlMs);
          metrics.inc('identity_upsert_total', { result: 'ok' });
          next();
        },
        (err: unknown) => {
          metrics.inc('identity_upsert_total', { result: 'error' });
          log.error('identity.upsert_failed', {
            userId: auth.userId,
            message: err instanceof Error ? err.message : String(err),
          });
          next(); // best-effort — the request continues, roles fall back to the floor
        },
      );
  };
}
