/**
 * Shared typed error for the HTTP error envelope (Phase 1 §12, Phase 2 §7.5).
 * Throw `AppError` (directly or via a subclass) anywhere in a request path and
 * the central error handler turns it into a stable
 * `{ error: { code, message, messageKey?, requestId, fieldErrors?, retryable } }`
 * response — never a stack.
 */

export interface AppErrorOptions {
  /** i18n lookup key the client resolves; `message` stays as the safe fallback. */
  messageKey?: string;
  /** Per-field validation errors, keyed by dotted field path. */
  fieldErrors?: Record<string, string[]>;
  /** Whether an identical retry could plausibly succeed. */
  retryable?: boolean;
}

export class AppError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly messageKey?: string;
  readonly fieldErrors?: Record<string, string[]>;
  readonly retryable: boolean;

  constructor(code: string, message: string, httpStatus = 400, options: AppErrorOptions = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.messageKey = options.messageKey;
    this.fieldErrors = options.fieldErrors;
    this.retryable = options.retryable ?? httpStatus >= 500;
  }

  /** Back-compat single-string projection of `fieldErrors` (Phase 1 envelope `fields`). */
  get fields(): Record<string, string> | undefined {
    if (!this.fieldErrors) return undefined;
    return Object.fromEntries(
      Object.entries(this.fieldErrors).map(([k, v]) => [k, v[0] ?? 'invalid']),
    );
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
