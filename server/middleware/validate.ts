import type { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { AppError } from '../lib/errors';

/**
 * Runtime request-body validation against a canonical `@contracts` schema
 * (Phase 2 §8, §12.4). On success `req.body` is replaced with the parsed (typed,
 * unknown-key-stripped where the schema strips) value. On failure a `400`
 * `AppError` with `fieldErrors` is thrown for the central handler.
 *
 * `code` lets a surface keep its stable Phase 1 error code
 * (e.g. `invalid_completion`) instead of the generic `invalid_request`.
 */
export function validateBody<S extends z.ZodTypeAny>(
  schema: S,
  code = 'invalid_request',
): (req: Request, _res: Response, next: NextFunction) => void {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(toAppError(result.error, code));
      return;
    }
    req.body = result.data as z.infer<S>;
    next();
  };
}

function toAppError(err: ZodError, code: string): AppError {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_root';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  const first = err.issues[0];
  const message = first
    ? `${first.path.join('.') || 'body'}: ${first.message}`
    : 'Request validation failed';
  return new AppError(code, message, 400, { fieldErrors });
}
