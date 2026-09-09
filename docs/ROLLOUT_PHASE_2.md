# Bible Games — Phase 2 rollout & rollback runbook

Phase 2 §27, made concrete for the flags Phase 2 actually ships. Each stage is
independently reversible; nothing here restores an insecure client write.

All flags default to the **legacy / safe** value — deploying the Phase 2 code
changes nothing until a flag is turned on.

---

## 1. Flags

| Flag | Values | Owner unit | Default |
|------|--------|-----------|---------|
| `CANONICAL_CONTENT_REPOSITORY` | `off` \| `compare` \| `canonical` | API | `off` |
| `REALTIME_GATEWAY_V2` | unset \| `true` | API/realtime | unset |
| `JOB_QUEUE_DRIVER` | `memory` \| `postgres` | worker | `memory` |
| `JOB_SCHEDULES_ENABLED` | unset \| `true` | **worker only** | unset |
| `OBJECT_STORAGE_DRIVER` | `filesystem` \| `s3` | worker/API | `filesystem` |
| `LEGACY_STORE_READONLY` | unset \| `true` | API | unset |

---

## 2. Rollout sequence

### 2.1 Schema & infrastructure (no behaviour change)

1. `npm run db:migrate` on staging, then production (idempotent, journal-guarded).
2. Deploy the API + worker with all flags at default.
3. Start the worker with `JOB_SCHEDULES_ENABLED=true` — the retention sweeps
   begin; nothing user-facing changes. Confirm `worker.schedules_registered` and,
   after the first tick, `job.completed` for the three sweep types.

### 2.2 Content repository (§14)

4. `npm run content:import-legacy` — populates `question_revisions` as
   `legacy_unreviewed`. Publish the sets you want served.
5. `CANONICAL_CONTENT_REPOSITORY=compare` — legacy is still served; every
   id-set divergence is logged (`content_source_divergence_total`). Watch for a
   quiet window.
6. `CANONICAL_CONTENT_REPOSITORY=canonical` — published revisions are served,
   legacy only as an empty-result fallback.
   **Rollback:** back to `compare`, then `off`. The legacy bank is untouched.

### 2.3 Realtime gateway v2 (§15)

7. `REALTIME_GATEWAY_V2=true` on the API/realtime process. Clients that
   understand the envelope apply it by sequence and resync on reconnect; older
   clients keep getting `room_state`.
   **Rollback:** unset the flag. In-flight rooms fall back to raw `room_state`.

### 2.4 Object storage (§19)

8. Default `filesystem` needs nothing. For `s3`: set `OBJECT_STORAGE_DRIVER=s3`
   + `S3_*` on the worker, confirm a `content.snapshot` job writes
   `snapshots/<setId>/latest.json` to the bucket.
   **Rollback:** back to `filesystem`; snapshots regenerate on the next job.

### 2.5 Preferences decomposition (§18.2)

9. `npm run migrate:backfill-preferences --dry` → review counts → run for real.
10. Deploy (no flag) — `writePreferences` now dual-writes `user_preferences`
    **and** the blob; reads overlay the typed value. Verify parity over a window
    (spot-check `select * from user_preferences` vs the blob).
11. `LEGACY_STORE_READONLY=true` — `activeTheme` / `avatar` / `bibleTranslation`
    writes stop touching the blob; the typed table is authoritative.
    **Rollback:** unset the flag. The blob copy resumes; because dual-write kept
    it fresh until step 11, no data was lost. (If a divergence is found, re-run
    the backfill — it is idempotent.)

### 2.6 Progression / entitlement decomposition — **not in Phase 2**

Typed tables + repositories for progression state (level/xp/rank/streak) and
achievements/entitlements, their backfill with a `migration_records`-style
provenance row, count/sum verification, then removal of the legacy write path.
Follows the same dual-write → verify → `*_READONLY` → drop pattern. Tracked as
the Phase 2 §26.1 remainder; it touches the reward/celebration hot path and
ships as its own change with its own rollout evidence.

---

## 3. Rollback principles (§27)

- New events / ledger rows / audit records are **never** deleted on rollback.
- Switch the **read projection** back only if the data is still consistent.
- Do **not** restore insecure client writes (the Phase 1 `PUT /profile` stays
  gone regardless).
- Keep migration markers (`drizzle.__migration_runs`, `migration_records`).
- For an already-consumed irreversible event, forward-fix with a new migration
  rather than restoring a backup.
- Keep the previous content snapshot available until the canonical repository is
  validated.
