import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Assigns a correlation id to every request (Phase 1 §12/§16). Honors an
 * inbound `x-request-id` when it looks safe, otherwise generates a UUID, and
 * always echoes it back on the response.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.header('x-request-id');
  const id = inbound && /^[\w-]{8,128}$/.test(inbound) ? inbound : crypto.randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  next();
}
