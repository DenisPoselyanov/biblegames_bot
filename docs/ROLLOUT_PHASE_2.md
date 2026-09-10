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
| `LEGACY_PROGRESSION_READONLY` | unset \| `true` | API | unset |

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

### 2.6 Progression / entitlement decomposition (§18.2, ADR-016)

Typed tables `progression_state` / `achievement_grants` / `player_theme_stats` /
`entitlements` replace the progression + entitlement fields of the
`player_profiles` / `player_stats` blobs. The reward hot path
(`/completions`, `/answers`, `/shop/purchases`) runs in one transaction with a
`progression_state` row lock.

12. `npm run db:migrate` — applies `0004`–`0006` (idempotent, journal-guarded).
13. `npm run migrate:backfill-progression -- --dry` → review the JSON report
    (`scanned` / `stateWritten` / `noUserRow` / `unknownCatalogIds`) → run for
    real → `npm run migrate:backfill-progression -- --verify-only` until
    `countsMatch` **and** `sumsMatch` are `true`. The script never touches
    `wallet_ledger`.
14. Deploy (no flag) — the reward path now writes the typed tables **and**
    mirrors the blob; `GET /me/profile` overlays the typed rows. Verify parity
    over a window (spot-check `progression_state` / `entitlements` vs the blob).
15. `LEGACY_PROGRESSION_READONLY=true` — the blob's progression / entitlement /
    theme-stat fields stop being written; the typed tables are authoritative.
    `reviewSchedules` + `displayName` still mirror.
    **Rollback:** unset the flag. The blob mirror resumes; because dual-write
    kept it fresh until step 15, nothing is lost. On a divergence, re-run the
    backfill (idempotent).
16. **The `productionValidation.ts` gate is already in `main`** (PR #13 /
    `c787fb1`) — it shipped inside the WS6 code, not as a later PR. So this is a
    **pre-deploy check, not a merge step:** confirm every production environment
    already sets `STORAGE_PROVIDER=sql` + `DATABASE_URL` *before* deploying any
    build at or after `bb45ddd`, or the server refuses to boot (fail-closed,
    §2.7). Every prod env has required `sql` since the Phase 1 wallet ledger, so
    this should already hold — verify, don't assume.
17. After the retention window, delete the legacy blob write path
    (`legacyBlobMirror`, the `applyCompletionBlob` / `applyAnswerBlob` / shop
    blob branches).

### 2.7 Retire `STORAGE_PROVIDER=json` in production (§26.1, ADR-006/016)

**Status: already live in `main`** as of PR #13 (`c787fb1`) — merged with the
WS6 code rather than held back. The production start-up gate refuses any
`STORAGE_PROVIDER` other than `sql`; non-production is unchanged. Because it is
already merged, step 16 is a pre-deploy environment check, not a follow-up
merge. **Rollback:** revert the one-line gate; only safe while a divergence has
not yet been written back into the blob (see §3).

---

## 3. Rollback principles (§27)

- New events / ledger rows / audit records — and `progression_state` /
  `entitlements` / `achievement_grants` rows — are **never** deleted on rollback.
- Switch the **read projection** back only if the data is still consistent.
- Do **not** restore insecure client writes (the Phase 1 `PUT /profile` stays
  gone regardless).
- Keep migration markers (`drizzle.__migration_runs`, `migration_records`).
- For an already-consumed irreversible event, forward-fix with a new migration
  rather than restoring a backup.
- Keep the previous content snapshot available until the canonical repository is
  validated.
