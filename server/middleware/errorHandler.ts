import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { RETRYABLE_ERROR_CODES, type ApiErrorEnvelope } from '../../contracts/index';
import { AppError } from '../lib/errors';
import { log } from '../lib/logger';
import { metrics } from '../lib/metrics';

/**
 * Central error handler (Phase 1 §12, Phase 2 §7.5). Client responses carry a
 * stable code, a safe message, an optional i18n `messageKey`, the request id,
 * `fieldErrors`, and a `retryable` hint — never a stack trace or secret. Full
 * detail is logged server-side with the request id.
 *
 * `fields` (Phase 1's single-string-per-field shape) is emitted alongside
 * `fieldErrors` during the WS4 client-cutover window.
 */

function fieldErrorsFromZod(err: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_root';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

function send(res: Response, status: number, envelope: ApiErrorEnvelope, legacyFields?: Record<string, string>): void {
  res.status(status).json(
    legacyFields ? { error: { ...envelope.error, fields: legacyFields } } : envelope,
  );
}

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

  // A ZodError that escaped a route (defensive — `validate()` normally wraps it).
  const appError =
    err instanceof AppError
      ? err
      : err instanceof ZodError
        ? new AppError('invalid_request', 'Request validation failed', 400, {
            fieldErrors: fieldErrorsFromZod(err),
          })
        : null;

  if (appError) {
    if (appError.httpStatus >= 500) {
      metrics.inc('server_error_total', { code: appError.code });
      log.error('request.error', { requestId, code: appError.code, message: appError.message });
    }
    const retryable = appError.retryable || RETRYABLE_ERROR_CODES.has(appError.code);
    const envelope: ApiErrorEnvelope = {
      error: {
        code: appError.code,
        message: appError.message,
        messageKey: appError.messageKey,
        requestId,
        fieldErrors: appError.fieldErrors,
        retryable,
      },
    };
    send(res, appError.httpStatus, envelope, appError.fields);
    return;
  }

  metrics.inc('server_error_total', { code: 'unhandled' });
  log.error('request.unhandled_error', {
    requestId,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  send(res, 500, {
    error: { code: 'internal_error', message: 'Internal server error', requestId, retryable: true },
  });
}
