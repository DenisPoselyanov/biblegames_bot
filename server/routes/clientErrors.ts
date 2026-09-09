/**
 * `POST /api/v1/client-errors` (Phase 2 §20).
 *
 * Safe frontend error reporting: the client posts `{ route, buildVersion, code,
 * level, message? }` — no stack, no payload, no user data (`clientErrorReport`
 * is `.strict()`). We log it as one structured line and bump a counter. Left
 * unauthenticated on purpose (errors happen before/around auth) but guarded by
 * a tight per-IP rate limit at the mount.
 */
import { Router } from 'express';
import { observabilityContract } from '../../contracts/index';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validate';
import { log } from '../lib/logger';
import { metrics } from '../lib/metrics';

export function createClientErrorsRouter(): Router {
  const router = Router();

  router.post(
    '/',
    validateBody(observabilityContract.clientErrorReport, 'invalid_client_error'),
    asyncHandler(async (req, res) => {
      const report = req.body as observabilityContract.ClientErrorReport;
      metrics.inc('client_errors_total', { code: report.code, severity: report.level });
      log.warn('client.error', {
        requestId: req.id,
        route: report.route,
        buildVersion: report.buildVersion,
        code: report.code,
        severity: report.level,
        message: report.message ? report.message.slice(0, 300) : undefined,
      });
      res.json({ ok: true });
    }),
  );

  return router;
}
