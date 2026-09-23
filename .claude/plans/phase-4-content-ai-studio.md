# Phase 4 execution plan — Content Quality, Reviewed AI Pipeline & Protected Content Studio

> Canonical spec: [`docs/phases/PHASE_4_CONTENT_AI_AND_CONTENT_STUDIO.md`](../../docs/phases/PHASE_4_CONTENT_AI_AND_CONTENT_STUDIO.md) (25 sections, DoD §23).
> Handoff in: [`docs/phases/PHASE_3_TO_4_HANDOFF.md`](../../docs/phases/PHASE_3_TO_4_HANDOFF.md).
> Design/IA reference: `proto/design-v2` branch, `src/proto/studio/{README,ROADMAP}.md` (commits `53d84d7`, `c452429`) — **not merged to `main`**, exists only on that local branch. It is a read-only click-through over synthetic data at desktop widths (≥1100px); its own `ROADMAP.md` already breaks the gap between prototype and real Studio into WS1–WS9 mapped to this spec's acceptance criteria. This plan follows that breakdown's shape but corrects its baseline assumptions against what Phase 1/2/3 actually shipped (see §0 below) — the prototype's `ROADMAP.md` was written assuming a mostly-greenfield content backend, which is no longer true.
> Status when written: Phase 3.5 merged to `main` (`8d17dc9`, PR #31). No Phase 4 workstream has started.

## 0. Baseline snapshot (verified in repo, 2026-09-22)

This phase is **not greenfield**. Phase 1/2/3 already built several of the primitives §7/§8/§10 ask for — Phase 4's job is largely to extend and wire them into a reviewed pipeline + protected UI, not invent them from zero.

**Already exists:**

- **Content revision model** (`server/domains/content/types.ts`): `QuestionRevisionRecord` with `status: ContentStatus`, `contentHash`, `source`, `createdBy`, `supersededAt`, `quarantineReason` — most of spec §5.1/§5.2's shape already. `ContentStatus` (`contracts/enums/index.ts`) is a **simplified 6-state** enum: `legacy_unreviewed | draft | ready_for_review | published | quarantined | archived` — narrower than spec §4's ~12-state lifecycle (no `validating`, `changes_requested`, `approved` vs `published` distinction, `scheduled`, `superseded`).
- **Validation** (`server/domains/content/validation.ts`, `validateQuestion()`) and **import** (`import.ts`) already exist for questions — schema-level only, not the full §6.2 deterministic-quality-check suite (dedup, bias, language) or §6.3 Scripture verification.
- **Generic job queue** (`server/domains/jobs/`): `JobQueue` interface with idempotency keys, checkpoint/resume, retry with backoff, dead-letter (`failed` after `maxAttempts`), in-memory + pg-boss adapters. This is exactly §8's `ContentJob` shape at the infrastructure level — §7/§8's actual gap is the **AI provider contract** and **content-specific job types**, not the runner itself.
- **RBAC roles** (Phase 1, `contracts/enums/index.ts` `ROLE_VALUES`): `content_reviewer` and `content_publisher` already exist as first-class roles alongside `admin`/`group_leader`/`support`. Permission-matrix wiring for Studio-specific actions (§11's `content.draft.create` etc.) is still open.
- **Lessons/objectives model** (Phase 3 WS1, `server/domains/learning/`): `learning_plans`/`modules`/`lessons`/`lesson_blocks`/`objectives`, all currently `legacy_unreviewed` (17 plans / 108 modules / 460 objectives / 460 lessons, mapped from legacy topics — nothing published). This is the other half of §5 that needs the same revision/status treatment questions already have.

**Does not exist yet:**

- No AI provider abstraction (`server/domains` has no `ai` or `content-ai` module) — the legacy scripts (`scripts/generate-questions-ai.mjs`, `fix-questions-ai.mjs`, `generate-topics-ai.mjs`, `ai-topic-edit.mjs`, `ollama_launcher.py`, `ai_launcher.py`, ~25 scripts total under `scripts/`) call providers ad hoc, per §2's exact complaint.
- No Scripture-evidence storage (§5.4), no deterministic quality-check suite (§6.2) beyond schema validation, no theological-sensitivity flagging (§6.5).
- No Content Studio route/bundle in `main` at all — only the unmerged prototype.
- No publication/release/rollback model (§13) — `PublishedContentSet`/`ContentSetFilter` types exist in `contracts/index.ts` but there is no versioned, atomic publish/rollback service behind them yet.
- No content-specific audit trail beyond Phase 1's generic RBAC audit log.
- No unified `npm run ai -- <task>` CLI (§9) — 25+ standalone scripts remain.

## 1. Open decisions before WS1 (need an owner call, not a default)

1. **Extend `ContentStatus` to the full spec lifecycle, or keep the current 6-state enum and layer the extra states as job/validation metadata instead of persisted status?** Recommend an ADR (mirrors ADR-016/017's pattern) that either (a) extends `CONTENT_STATUS_VALUES` with `validating`/`changes_requested`/`approved`/`scheduled`/`superseded` — a migration touching every row that reads this enum — or (b) keeps `published`/`quarantined`/`archived`/`draft`/`ready_for_review` as the *persisted* states and represents `validating`/`in_review`/`approved`/`scheduled` as transient job/review-record state that resolves into one of the persisted five. Option (b) is less disruptive to Phase 2/3 code already reading `ContentStatus` and is the default recommendation below.
2. **Which AI providers actually get wired live in Phase 4** — resolved 2026-09-22: Ollama is removed from the owner's laptop (no local models), so WS1 targets **cloud-only, free-tier** providers instead of the spec's original Ollama/Gemini/OmniRoute trio:
   - **Gemini** (already integrated, `scripts/lib/gemini.mjs`) stays as one contract implementation.
   - **Groq** (new, primary recommendation) and **OpenRouter** (new, fallback/rotating free-model catalog) — both OpenAI-compatible (`/chat/completions` + Bearer token), so `scripts/lib/omniroute.mjs`'s existing generic client already works against them by pointing `OMNIROUTE_BASE_URL`/`OMNIROUTE_API_KEY` at Groq's or OpenRouter's endpoint instead of a local gateway — no new HTTP client code needed for a first cut, see [`docs/AI_SETUP.md`](../../docs/AI_SETUP.md)'s "Безкоштовні хмарні провайдери" section (updated 2026-09-22) for exact base URLs/limits/env examples.
   - Free-tier limits are real constraints for WS1's budget/rate-limit design (§7.2/§8.2), not just a cost question: Groq ≈30 req/min per model, OpenRouter 20 req/min / 50 req/day (up to 1000/day only if the owner tops up $10, not required). WS1's `AiProvider` contract should treat these as hard per-provider budgets and support failing over from one free provider to another rather than assuming unlimited retries.
   - Cohere's free tier is non-commercial-only — excluded.
   - **Known live bug, not just docs**: `scripts/lib/llm.mjs`'s `resolveProvider()`/`resolveModel()` still default to `'ollama'` when no `--provider`/`AI_PROVIDER` is set — every legacy script invoked without an explicit provider flag is currently broken. WS1 should remove the `ollama` fallback (and `ollama.mjs`) as part of building the real `AiProvider` contract, not carry it forward as legacy dead code; until WS1 lands, treat this as a standing gotcha for anyone running the old scripts (documented in `docs/AI_SETUP.md`).
3. **Decided by owner (2026-09-22): `proto/design-v2`'s `/proto/studio` is the source of truth for Studio UI/IA — build from it, not around it.** WS8 starts by merging/porting the prototype's actual code (routes, screen structure, `Term`/glossary pattern, three-depth-level navigation, light/dark theme handling) from the `proto/design-v2` branch as the literal starting scaffold, then wires it to real WS1–WS7 data/auth instead of synthetic fixtures. Where the prototype and this spec disagree on a *detail* (screen name, which tab a feature lives under), the prototype wins per its own header note; where they disagree on a *principle* (§3 non-negotiables, RBAC boundaries, audit, no-fake-progress), this spec still wins — the prototype's synthetic click-through has no auth/RBAC/audit wiring at all yet, so those layers are added, not sourced from it.
4. **Lessons get the same revision/status treatment as questions in this phase, not deferred** — the spec's §5.3/§21 scope covers both; WS2 below includes lessons explicitly for that reason, even though the prototype's `ROADMAP.md` (written before Phase 3 landed the lessons model) only mentions questions.

## 2. Workstream graph

```text
WS1 (AI provider contract + content-specific job types, atop existing JobQueue)
  └─> WS2 (Content lifecycle model: extend question status machine + bring lessons to parity; drafts/revisions/diff)
        ├─> WS3 (Validation pipeline: schema + deterministic quality checks + theological-sensitivity flag)
        │     └─> WS4 (Scripture evidence: reference normalization + trusted-source adapter + verdicts)
        ├─> WS5 (RBAC hardening: Studio permission matrix, fail-closed endpoints, separate bundle/session boundary)
        └─> WS6 (Publication/release/rollback: atomic published-set versioning)
              └─> WS7 (Content-specific audit trail: extends Phase 1's audit log)
WS5 + WS6 + WS7 ──┬─> WS8 (Content Studio UI: dashboard, jobs, review, library, releases, settings, guide)
WS3 + WS4 ────────┘
WS8 └─> WS9 (Quality analytics feedback loop: outlier detection → repair job)
WS1..WS8 └─> WS10 (Unified CLI, legacy script deprecation matrix, full legacy bank audit + migration waves)
```

WS1 and WS2 are the foundation everything else reads from — no other workstream should start against fabricated data. WS3/WS4 (validation) and WS5/WS6/WS7 (access/publish/audit) can run in parallel once WS2 lands. WS8 (the actual Studio UI) is the largest single workstream and should probably split into sub-PRs per screen (dashboard, jobs, review, library, releases, settings/guide) rather than one PR, following the Phase 3 stacked-branch pattern (`phase-4/wsN-slug`).

## 3. Workstreams

### WS1 — AI provider contract & content job types — **code complete (2026-09-22)**
- Landed: `server/domains/ai/types.ts` (`AiProvider` contract — `generateText`/`generateObject`, `AiResult`/`AiResultMeta` with provider/model/attempt/duration/usage/warnings/cost estimate, `AiProviderError` classified `auth | rate_limited | timeout | invalid_response | unknown` each with a `retryable` flag); `server/domains/ai/budget.ts` (`BudgetTracker`, hard stop on `maxRequests`/`maxTokens`/`maxCostUsd`, resumable from a checkpoint — §8.2 "no infinite retries", "per-job and global budgets").
- Adapters under `server/infrastructure/ai/` (mirrors `server/infrastructure/storage/`'s pure-interface/adapter split): `geminiProvider.ts` (real, same request shape as `scripts/lib/gemini.mjs` but classifies failures instead of sleep-retrying internally — the job queue's own backoff owns retry timing, no duplicate retry loop), `openAiCompatibleProvider.ts` (generic `chat/completions` + Bearer client — the same shape `scripts/lib/omniroute.mjs` already used locally, generalized for Groq/OpenRouter; not wired into `createAiProvider()`'s selection yet since **Gemini is the chosen primary for now**, owner decision 2026-09-22 — adding Groq/OpenRouter later is a config change, not new code), `mockProvider.ts` (deterministic, scripted responses/errors for orchestration tests per §7.4). `createAiProvider(config)` in `infrastructure/ai/index.ts` selects by `CONTENT_AI_PROVIDER` (`off | gemini | groq | openrouter | mock` — deliberately a different env var than legacy `AI_PROVIDER`, see decision #2's note below), returning `null` when unconfigured rather than throwing.
- `server/config/env.ts` gained `aiProvider`/`geminiApiKey`/`geminiModel`/`groqApiKey`/`groqModel`/`openRouterApiKey`/`openRouterModel`/`aiJobBudget` (env: `CONTENT_AI_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GROQ_API_KEY`, `GROQ_MODEL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `AI_JOB_MAX_REQUESTS`, `AI_JOB_MAX_TOKENS`); `productionValidation.ts` fails closed on `CONTENT_AI_PROVIDER=mock` in production and on a selected provider missing its API key (§7.2 "no silent model switch"). `GEMINI_API_KEY`/`GEMINI_MODEL` are intentionally shared with the legacy scripts' vars — same meaning either side.
- New job type `content.ai_generate` in `server/domains/jobs/catalog.ts` (Zod payload: `promptVersion`, `prompt`, optional `label` — §7.3 prompt versioning travels with every job) plus its handler `server/jobs/contentAi.ts` — one AI call per job, writes the raw result to `ai-artifacts/<jobId>.json` in the existing `ObjectStore` (never to a content repository — turning an artifact into a draft/revision with schema/status is WS2's job, not this one). Wired into `registerCoreJobs`/`server/worker.ts` via an optional `ai` dependency bag, registered only when a provider is actually configured — no handler that always fails.
- Deliberately **not** in this workstream: `content.repair`/`content.import`/`content.validate-batch` job types, and batch/multi-call generation — WS1 ships the single-call primitive end-to-end (provider → budget → job → artifact); WS2's content model is what a repair/import/batch job would write into, so those wait for it rather than being built against nothing. Removing the `scripts/lib/`'s `ollama` provider path and its `'ollama'` default fallback is WS10's scope (legacy CLI tooling), not this workstream's new server-side contract — still a documented gotcha in `docs/AI_SETUP.md` until then.
- Tests: `server/domains/ai/__tests__/budget.test.ts` (6), `server/infrastructure/ai/__tests__/{mockProvider,geminiProvider}.test.ts` (11, incl. rate-limit/auth/invalid-JSON/truncated-response classification), `server/jobs/__tests__/contentAi.test.ts` (4, incl. a queue-backoff retry-then-succeed case and a checkpoint-resume case) — all green; full suite 488/488, `tsc -p server/tsconfig.json` and `eslint` clean on every new/changed file.
- **Depends on**: nothing (independent of WS2, as planned).
- **DoD tie-in**: §23.11.

### WS2 — Content lifecycle model (questions + lessons) — **code complete (2026-09-22)**
- Resolved open decision #1 via **ADR-019** (`docs/DECISIONS.md`): `ContentStatus` stays the existing 6-state enum (plan §1.1's option (b), now the accepted decision, not just a recommendation) — the spec's extra lifecycle states (`validating`/`in_review`/`changes_requested`/`approved`/`scheduled`/`superseded`) are represented as job/review-record/audit metadata layered over the 5 persisted states, not new enum values. No migration touching existing rows.
- **Field-level diff**: `server/domains/shared/revisionDiff.ts`'s `diffFields()` — generic, deep-JSON-equality per field, shared by both domains. `content/diff.ts`'s `diffQuestionRevisions()` and `learning/diff.ts`'s `diffLessonRevisions()` are thin field-list wrappers — the data WS8's review editor renders side-by-side.
- **Lesson revisions** (ADR-019 §2): new `lesson_revisions` table (migration `0010_lesson_revisions.sql`) — an additive, immutable layer over the existing mutable `lessons`/`lesson_blocks` rows (Phase 3 WS1 deliberately shipped without one). Denormalized snapshot (`title`/`description`/`blocks` as an ordered jsonb array, not a separate block-revision table), numbered per `lessonId`, one `published` at a time (partial unique index) — mirrors `question_revisions` 1:1 in shape. `server/domains/learning/`: `types.ts` (+`LessonRevisionRecord`/`LessonRevisionDraft`/`LessonRevisionBlock`/`AppendLessonRevisionOutcome`), `repository.ts` (+`LessonRevisionRepository`), `lessonHash.ts` (body hashing, shares `stableHash` with `content`), `diff.ts`, `inMemoryRepository.ts` + SQL adapter (`server/infrastructure/database/repositories/learning.ts`). `publishRevision` writes the snapshot through to the mutable `lessons`/`lesson_blocks` rows in the same `tx` (`source: 'authored'`), so Learn hub's existing direct reads of those tables are unaffected by drafts — Content Studio becomes a second writer alongside the topic-tree mapping script.
- `correctIndex` (question) never falls back to a default on invalid input — already true pre-WS2 (`server/domains/content/validation.ts`, §14/§22); lesson-block required fields have no separate free-text validation gate yet (WS3's job — WS2 only adds the storage/diff layer, not the deterministic quality-check suite).
- **DB-level write restriction** (§3.2/§22): `server/domains/shared/contentWriteGuard.ts`'s `assertAiWriteAllowed(source, status)` — runtime backstop beyond `RevisionDraft.status`'s compile-time union, rejecting an AI-originated `appendRevision` call that requests anything other than `draft`/`legacy_unreviewed`, wired into both question and lesson repositories (in-memory + SQL). Endpoint-level permission matrix stays WS5's scope.
- Tests: `server/domains/shared/__tests__/{revisionDiff,contentWriteGuard}.test.ts` (7), `server/domains/content/__tests__/diff.test.ts` (3) + a guard-rejection case added to `repositoryContract.ts`, `server/domains/learning/__tests__/diff.test.ts` (3) + 5 new lesson-revision cases (append/idempotency, publish write-through, quarantine, AI-write guard) added to `repositoryContract.ts` (runs vs in-memory + pglite) — all green; full suite 511/511, `tsc -p server/tsconfig.json` and `eslint` clean on every new/changed file. `schemaParity` allowlist +1 (`lesson_revisions`).
- **Depends on**: WS1 (job types reference content records), decision #1.
- **DoD tie-in**: §23.1, §23.3.

### WS3 — Validation pipeline
- Schema validation layer reusing/extending `server/domains/content/validation.ts`'s existing `validateQuestion()` rather than replacing it.
- Deterministic quality checks (§6.2): exact/near-duplicate detection, first-option bias, answer leakage in wording, option-length imbalance, missing/weak explanations, mixed-language detection, orphan topic/objective references.
- Theological-sensitivity flagging (§6.5) as an explicit, non-automatable category — sensitive items block auto-approval regardless of every other check passing.
- Each check result stored with the draft (label/severity/detail/kind) — this is the data WS8's review-editor right rail renders, not a separate reporting system.
- **Depends on**: WS2 (drafts to validate).
- **DoD tie-in**: §23.3.

### WS4 — Scripture evidence
- Reference normalization (`Ів 3:16` / `Івана 3:16` / `JHN.3.16` → one key).
- Trusted-source adapter (start with the already-used Ukrainian translation data this repo has for Scripture features — check `server/domains` / `src/lib` for an existing translation-text source before adding a new one).
- Verdicts `match | paraphrase | mismatch | not_found`, evidence stored (source text snapshot, retrieval time, adapter version) per §5.4.
- Publication blocked on `mismatch`/`not_found`; `paraphrase` requires an explicit human decision.
- **Depends on**: WS2/WS3 (runs as part of the same validation pass).
- **DoD tie-in**: §23.7.

### WS5 — RBAC hardening for Studio
- Extend Phase 1's `content_reviewer`/`content_publisher` roles with the specific permission set from §11 (`content.draft.create`, `content.import`, `content.ai.run`, `content.review`, `content.approve`, `content.publish`, `content.rollback`, `content.audit.read`).
- Every Studio endpoint fail-closed (403 without permission, independent of whether the UI hid the control) — feature flags never substitute for authorization.
- Studio ships as a separate route/bundle, not inside the user-facing chunk (§10.1) — verify with a bundle-boundary test, same pattern as Phase 3 WS10 §18's question-bank bundle test.
- Environment/session binding so a staging session cannot publish to production.
- **Depends on**: WS2 (permissions gate content actions).
- **DoD tie-in**: §23.4.

### WS6 — Publication, release, rollback
- Immutable, versioned published-set snapshot (item revision IDs, objective/topic mapping, localization version, asset hashes, schema-compat version, actor+timestamp) per §13.1.
- Atomic activation — no sequential multi-file production update (§13.2).
- Rollback switches the active published set to a prior validated version without hand-editing JSON, and does not delete the superseded revision (§13.4, §22).
- Scheduled publication gated on every included item being `approved`/validated clean.
- **Depends on**: WS2, WS3/WS4 (nothing publishes without passing validation), WS5 (publish/rollback are permissioned actions).
- **DoD tie-in**: §23.6.

### WS7 — Content-specific audit trail
- Extend Phase 1's audit log (don't fork a second one) to cover content actions: generate, validate, review decision, approve, publish, rollback, and denied attempts (fail-closed 403s are audit-worthy too).
- Append-only, exportable by period; system actions (job runner, validators) attributed to a `system` actor distinct from human actors.
- **Depends on**: WS5 (permissioned actions to log), WS6 (publish/rollback events).
- **DoD tie-in**: §23.5, §23.14 (audit portion).

### WS8 — Protected Content Studio UI
- **Port, don't re-derive**: start by bringing `proto/design-v2`'s `src/proto/studio/*` (7-menu, 10-route IA: dashboard, `jobs`/`jobs/new`/`jobs/:id`, `review`/`review/:id`, `library`, `releases`, `settings`, `guide`; the three-depth-level list→drawer→full-page pattern; `Term`/`lib/glossary.ts` inline explanations; light/dark theme tokens) into `main` as the literal starting point per decision #3, under the real (non-`/proto`) Studio route.
- Replace every synthetic-data read with real WS1–WS7 endpoints one screen at a time; add the auth/RBAC/audit layer the prototype never had (§10.1) — the prototype proved screens and motion, not the backend, so this is genuinely new wiring even though the JSX/IA is inherited.
- Screens: Dashboard (queue counts, failed jobs, review workload, publication status, quality alerts — no vanity AI metrics); Draft/import workspace; Job dashboard (provider/model/prompt version, status, attempts, logs with secrets redacted); Review queue + Review editor (side-by-side diff, production renderer preview, Scripture evidence, approval with explicit confirmation); Publication (releases, rollback); Content history (audit timeline); Library (theme tree + quality tabs); Settings (providers, prompt versions, permission matrix); Guide (onboarding, ported near-verbatim).
- Motion/density per spec §15 and already encoded in the prototype: 14px base type, opaque panels (no blur on a data grid), visible scrollbars, theme follows OS with manual override, no confetti/decorative motion during review.
- `AdminPanel.tsx`/`ScripturePreview.tsx` stay live and untouched until each of their functions has a Studio equivalent (§10.1's retirement mapping table) — deletion is a later, explicit step once coverage is confirmed, not part of this workstream.
- Recommend splitting into per-screen sub-PRs given size (port+dashboard+jobs / review / library+releases+settings / guide+polish), stacked like Phase 3's WS6-9.
- **Depends on**: WS3/WS4 (review data), WS5 (access boundary), WS6 (publish/rollback actions), WS7 (history screen).
- **DoD tie-in**: §23.4, §23.9.

### WS9 — Quality analytics feedback loop
- Gameplay signal aggregation (question correctness rate, per-band distribution, first-option bias in the wild, outlier detection) without extra personal data.
- User content error reports (§14): authenticated report → category → duplicate grouping → reviewer queue → resolution → audit link to the resulting revision. Reports never directly mutate content (§22).
- One-click "this is an outlier" → enqueues a `content.repair` job (WS1's job types) rather than a separate ad hoc path.
- **Depends on**: WS1 (repair job type), WS7 (audit link), WS8 (surfaced in Dashboard).
- **DoD tie-in**: §23.13, §23.18 (observability portion).

### WS10 — Unified CLI & legacy migration
- `npm run ai -- <task>` single entry point sharing the WS1 runner with the Studio (§9).
- Deprecation matrix for all ~25 scripts under `scripts/` (`generate-questions-ai.mjs`, `fix-questions-ai.mjs`, `generate-topics-ai.mjs`, `ai-topic-edit.mjs`, `dedupe-question-db.mjs`, `balance-questions.mjs`, `scripture-audit.mjs`, `import-questions-supabase.ts`, `generate-kahoot-playlist.mjs`, etc.): mapped replacement, deprecation warning, compatibility period, owner, removal target, golden-dataset comparison.
- Full legacy content-bank audit (§12.1/§12.2): counts and classification by source/theme/difficulty/type/language/reference-presence/explanation-presence/validation-state/duplicate-group/bundle-size/active-route.
- Migration waves per §12.3 (core practice pools → Phase 3 learning-plan content → Kahoot playlists → remaining themes → rare/experimental → archive unsupported), each with before/after metrics and rollback.
- **Depends on**: everything above (this is the phase's closing workstream, per DoD §23.8/§23.12/§23.15).
- **DoD tie-in**: §23.8, §23.12, §23.15.

## 4. Testing strategy notes

Phase 3 closed with two acknowledged gaps this phase inherits and should not silently re-hit: no visual-regression suite, no `@testing-library/react`/jsdom component harness (component logic gets extracted into plain `.ts` modules where possible, same pattern WS6/WS7 of Phase 3 used). Phase 4's own §19 wants schema/validator tests, AI-orchestration tests (against `MockProvider`), review/publication integration tests, security tests (RBAC bypass attempts, audit immutability), and golden datasets for Ukrainian wording/Scripture references/duplicate detection — all of these are plain `.ts`/integration-level and don't depend on a component-rendering harness existing, so they're achievable without first solving Phase 3's test-infra gap.

## 5. Handoff awareness

Per spec §25 / handoff doc, Phase 5 (social/Kahoot) needs published content revisions and cannot bypass Content Studio for shared material — WS6's publication API is the contract Phase 5 will consume, so its shape should stay stable once WS6 ships.
