/**
 * Shared typed error for the HTTP error envelope (Phase 1 §12).
 * Throw `AppError` (directly or via a subclass) anywhere in a request path and
 * the central error handler turns it into a stable
 * `{ error: { code, message, requestId, fields? } }` response — never a stack.
 */
export class AppError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly fields?: Record<string, string>;

  constructor(
    code: string,
    message: string,
    httpStatus = 400,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.fields = fields;
  }
}

export class UnauthorizedError extends AppError {
  constructor(code: string, message = 'Authentication required') {
    super(code, message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(code = 'forbidden', message = 'Not allowed') {
    super(code, message, 403);
    this.name = 'ForbiddenError';
  }
}
