import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';
import { log } from '../lib/logger';
import { metrics } from '../lib/metrics';

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId?: string;
    fields?: Record<string, string>;
  };
}

/**
 * Central error handler (Phase 1 §12). Client responses carry a stable code, a
 * safe message, the request id and optional field errors — never a stack trace
 * or secret. Full detail is logged server-side with the request id.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  const requestId = req.id;

  if (err instanceof AppError) {
    if (err.httpStatus >= 500) {
      metrics.inc('server_error_total', { code: err.code });
      log.error('request.error', { requestId, code: err.code, message: err.message });
    }
    const body: ErrorEnvelope = {
      error: { code: err.code, message: err.message, requestId, fields: err.fields },
    };
    res.status(err.httpStatus).json(body);
    return;
  }

  metrics.inc('server_error_total', { code: 'unhandled' });
  log.error('request.unhandled_error', {
    requestId,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  const body: ErrorEnvelope = {
    error: { code: 'internal_error', message: 'Internal server error', requestId },
  };
  res.status(500).json(body);
}
