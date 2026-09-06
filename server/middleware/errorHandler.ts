import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';

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
      console.error(`[${requestId}] ${err.code}:`, err.message);
    }
    const body: ErrorEnvelope = {
      error: { code: err.code, message: err.message, requestId, fields: err.fields },
    };
    res.status(err.httpStatus).json(body);
    return;
  }

  console.error(`[${requestId}] unhandled_error:`, err);
  const body: ErrorEnvelope = {
    error: { code: 'internal_error', message: 'Internal server error', requestId },
  };
  res.status(500).json(body);
}
