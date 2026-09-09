import { apiErrorEnvelope, RETRYABLE_ERROR_CODES } from '@contracts';

/**
 * A failure the server described through the canonical §7.5 error envelope, or a
 * bare HTTP status when the body was not an envelope. `code` is the stable
 * machine code; `messageKey` is the i18n lookup key (`message` is the safe
 * dev-facing fallback); `retryable` is the server's own hint, OR-ed with the
 * always-retryable code set.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly messageKey?: string;
  readonly requestId?: string;
  readonly fieldErrors?: Record<string, string[]>;
  readonly retryable: boolean;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    messageKey?: string;
    requestId?: string;
    fieldErrors?: Record<string, string[]>;
    retryable?: boolean;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.messageKey = init.messageKey;
    this.requestId = init.requestId;
    this.fieldErrors = init.fieldErrors;
    this.retryable = init.retryable ?? false;
  }
}

/** A transport failure with no HTTP response at all (DNS, offline, TLS, CORS). */
export class ApiNetworkError extends Error {
  readonly requestId?: string;
  readonly retryable = true;
  override readonly cause?: unknown;

  constructor(message: string, opts?: { cause?: unknown; requestId?: string }) {
    super(message);
    this.name = 'ApiNetworkError';
    this.cause = opts?.cause;
    this.requestId = opts?.requestId;
  }
}

function headerRequestId(response: Response): string | undefined {
  try {
    return response.headers?.get?.('x-request-id') ?? undefined;
  } catch {
    return undefined;
  }
}

/** Turn a non-2xx `Response` into a typed {@link ApiError}. */
export async function parseApiError(
  response: Response,
  fallbackRequestId?: string,
): Promise<ApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    /* non-JSON error body — fall back to the status line */
  }

  const parsed = apiErrorEnvelope.safeParse(body);
  const fromHeader = headerRequestId(response);

  if (parsed.success) {
    const e = parsed.data.error;
    return new ApiError({
      status: response.status,
      code: e.code,
      message: e.message,
      messageKey: e.messageKey,
      requestId: e.requestId ?? fromHeader ?? fallbackRequestId,
      fieldErrors: e.fieldErrors,
      retryable: e.retryable || RETRYABLE_ERROR_CODES.has(e.code),
    });
  }

  return new ApiError({
    status: response.status,
    code: `http_${response.status}`,
    message: response.statusText || `HTTP ${response.status}`,
    requestId: fromHeader ?? fallbackRequestId,
    retryable: response.status >= 500 || response.status === 429,
  });
}
