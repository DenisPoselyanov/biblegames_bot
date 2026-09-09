# Bible Games — observability

Phase 2 §20. Standardises logs, IDs and metrics across every process
(API, realtime, worker, bot, migration command).

---

## 1. Structured log schema

One JSON object per line — `stdout` for `info` / `warn`, `stderr` for `error`
(`server/lib/logger.ts`). Every line carries:

| Field | Always | Meaning |
|-------|--------|---------|
| `ts` | yes | ISO-8601 timestamp |
| `level` | yes | `info` \| `warn` \| `error` — **reserved**; callers must not pass a `level` field |
| `msg` | yes | dotted event name, e.g. `job.completed`, `http.slow_request`, `client.error` |
| `requestId` | HTTP paths | correlation id, echoed to the client as the `x-request-id` response header |
| `jobId` + `type` | job paths | queue job id and job type |
| `eventId` | realtime | `RealtimeEvent` envelope id (§15) |

**Never logged:** raw Telegram `initData`, full profiles, wallet payloads,
tokens, `DATABASE_URL`, request/response bodies, stack traces with local paths.
Pass a `requestId` and coarse context instead.

### Correlation

The client generates an `x-request-id` (`src/lib/apiClient`), the server accepts
it when it matches `^[\w-]{8,128}$` and echoes it back. A user-reported problem
→ `x-request-id` from the network tab → server logs for that request. Jobs use
their own `jobId`; a job enqueued by a request should log the originating
`requestId` in its payload/checkpoint where it matters.

---

## 2. Metric catalog

In-process monotonic counters (`server/lib/metrics.ts`), served as a flat JSON
map at `GET /metrics` (unauthenticated, safe — label values are low-cardinality
non-PII strings only).

| Metric | Labels | Source |
|--------|--------|--------|
| `http_requests_total` | `method`, `status` (`2xx`…`5xx`) | every response (`middleware/httpMetrics`) |
| `http_server_errors_total` | `route` | responses ≥ 500 |
| `db_queries_total` | `op` (`select telemetry_events`) | every pooled query (`infrastructure/database/instrument`) |
| `db_slow_queries_total` | `op` | query ≥ 200 ms (also `warn` `db.slow_query`) |
| `db_query_errors_total` | `op` | query rejected |
| `jobs_enqueued_total` / `_started_total` / `_completed_total` / `_retried_total` / `_failed_total` | `type` | job queue (§17) |
| `client_errors_total` | `code`, `severity` | `POST /api/v1/client-errors` |
| `auth_failed_total`, `authz_denied_total`, `rate_limited_total`, `rate_limit_store_error_total` | varies | Phase 1 security paths |
| `idempotency_replay_total`, `reward_failed_total`, `role_resolve_total`, `identity_upsert_total` | varies | command surface |
| `content_source_divergence_total` / `_compare_total` / `_error_total` | — | `CANONICAL_CONTENT_REPOSITORY=compare` (§14) |
| `server_error_total` | `code` | central error handler |

**Slow thresholds:** HTTP request ≥ 1000 ms → `warn http.slow_request`;
DB query ≥ 200 ms → `warn db.slow_query`.

### Known limitations (→ Phase 7)

- Counters are **per-process and in-memory** — they reset on restart and are not
  aggregated across the API / worker / realtime processes.
- The **worker does not expose `/metrics`** (no HTTP server); its observability
  is structured logs only (`worker.start`, `worker.schedules_registered`,
  `job.completed`, `job.retry`, `job.failed`).
- `server/lib/metrics.ts` is explicitly a placeholder for a real metrics backend
  (Prometheus / OTel) — the `metrics.inc(...)` call sites do not change when it
  is replaced.

---

## 3. Migration observability

`npm run db:migrate` records every run in `drizzle.__migration_runs` (migration
name, status, timing). The journal (`server/migrations/meta/_journal.json`)
guards re-runs — a second `db:migrate` is a logged no-op. See
[DEPLOYMENT.md](./DEPLOYMENT.md) §4.2.

---

## 4. Frontend error reporting

`src/lib/errorReporter.ts` captures `window.onerror`, unhandled promise
rejections, and React error-boundary catches (`components/ErrorBoundary`), and
sends a **minimal** report to `POST /api/v1/client-errors`
(`sendBeacon`, hard-capped at 10 per page load, de-duplicated for 10 s):

```jsonc
{
  "route": "/play/study/quiz",   // location.pathname, ≤ 200 chars — no query, no ids
  "buildVersion": "1.4.0-abc",   // __APP_VERSION__ baked in by Vite (VITE_BUILD_ID | <pkg>-dev)
  "code": "render_error",        // lowercase slug: window_error | unhandled_rejection | render_error
  "level": "error",              // error | warn
  "message": "Cannot read properties of undefined"  // ≤ 300 chars, optional
}
```

**Never sent:** stack traces, component trees, props/state, user data, tokens.
The contract (`contracts/api/observability.ts`) is `.strict()` — an unknown key
(e.g. `stack`) is a 400. The endpoint is unauthenticated (errors happen around
auth) and guarded by a 30 req/min per-IP limit; the server logs each as
`warn client.error` and bumps `client_errors_total`.

The `x-contract-version` response header carries the runtime contract version on
every API response (Phase 1); mismatches are visible client-side.
