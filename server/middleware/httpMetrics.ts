/**
 * HTTP request metrics + timing (Phase 2 §20).
 *
 * One counter per `(method, routed path, status class)` and a slow-request
 * warn log. Route label is the mounted Express route pattern
 * (`/api/v1/progression/completions`), never the raw URL — no ids, no query.
 */
import type { NextFunction, Request, Response } from 'express';
import { log } from '../lib/logger';
import { metrics } from '../lib/metrics';

/** Requests slower than this get a `http.slow_request` warn. */
const SLOW_MS = 1_000;

function routeLabel(req: Request): string {
  // `req.route` is only set once a handler matched; its `path` keeps param
  // placeholders (`/:id`), so it is safe as a low-cardinality label. Without a
  // matched route, fall back to the mount path only — never `req.path`, which
  // carries real ids and would blow up the label space.
  const base = req.baseUrl || '';
  const path = (req.route as { path?: string } | undefined)?.path;
  if (typeof path === 'string' && path !== '/') return `${base}${path}`;
  return base || 'unmatched';
}

export function httpMetrics(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const statusClass = `${Math.floor(res.statusCode / 100)}xx`;
    const route = routeLabel(req);
    metrics.inc('http_requests_total', { method: req.method, status: statusClass });
    if (res.statusCode >= 500) {
      metrics.inc('http_server_errors_total', { route });
    }
    if (durationMs >= SLOW_MS) {
      log.warn('http.slow_request', {
        requestId: req.id,
        method: req.method,
        route,
        status: res.statusCode,
        durationMs: Math.round(durationMs),
      });
    }
  });
  next();
}
