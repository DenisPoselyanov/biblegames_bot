# Phase 3 execution plan — Learning Product, Rebrand & Motion

> Canonical spec: [`docs/phases/PHASE_3_LEARNING_PRODUCT_REBRAND_AND_MOTION.md`](../../docs/phases/PHASE_3_LEARNING_PRODUCT_REBRAND_AND_MOTION.md) (27 sections, DoD §25).
> Binding domain docs: `docs/PHASE_3_REBRANDING_AND_THEME_SYSTEM.md`, `docs/DESIGN_RULES.md`, `docs/MOTION_SYSTEM.md`.
> Rebrand/motion architecture already has accepted ADRs: **ADR-009** (light theme + semantic tokens), **ADR-010** (one canonical motion system + authoritative celebrations) in `docs/DECISIONS.md`. This plan sequences *implementation*, it doesn't re-decide those.
> Status when written: Phase 2 code-complete in `main` (`c264886`); rollout steps 14–17 pending live deployment (independent track, not a blocker for Phase 3 dev — see [PHASE_STATUS.md](../../docs/PHASE_STATUS.md)).

## 0. Baseline snapshot (verified in repo, 2026-09-14)

- **No Learning domain exists yet.** `server/domains/` has `content` (questions/topics, revisions), `progression`, `economy`, `identity`, `jobs`, `storage` — nothing for plans/modules/lessons/objectives. `server/routes/` has `me.ts`, `progression.ts`, `questions.ts`, `shop.ts`, `scripture.ts` — no `learning.ts`, no `/api/v1/learning/today`, no review-scheduler contract.
- **Frontend already has some of the target pages** as legacy implementations to migrate, not build from scratch: `src/pages/Home.tsx`, `Lesson.tsx`, `StudyHub.tsx`, `ReviewQueue.tsx`, `ProgressDashboard.tsx`, `Themes.tsx`/`ThemeDetail.tsx`, `Profile.tsx`, plus `pages/play/*`, `pages/social/*`.
- **Libraries already in place**: `@tanstack/react-query` 5.x, `framer-motion` 12.x, `zustand` 5.x, React Router. No new core dependency should be needed for Phase 3.
- **Phase 1/2 authority surfaces to build on, not duplicate**: server-authoritative `/api/v1/progression/completions`, `/progression/answers`, `/me/profile`, `/me/preferences`, `/me/learning-state`, typed `progression_state` / `achievement_grants` / `player_theme_stats` / `entitlements` tables (WS6, ADR-016).

This confirms the spec's own framing (§27, "Phase 4 replaces legacy content mutation... without rebuilding the learning UI") — **Phase 3 must build a minimal Learning domain data model itself**; it isn't hiding somewhere in Phase 2.

## 1. Open decision before WS1 (needs a product-owner call, not a default)

**How much Learning-domain authoring goes in Phase 3 vs Phase 4?**
Phase 3 DoD (§25.3) requires Learn to "support plans, modules, lessons and objectives" with real data — that means *schema + a mapping/import path* from existing themes/questions is in scope now. Phase 4 owns the reviewed *authoring/publication pipeline* (Content Studio UI, AI-assisted drafting, staging/review workflow). Recommended split, used below:

- **Phase 3 builds**: `learning_plans` / `learning_modules` / `lessons` / `lesson_blocks` / `objectives` tables, a one-time/repeatable **mapping script** that derives plans/modules/lessons from existing topics+questions (quarantining anything unmapped per §21), and read-side APIs.
- **Phase 4 builds**: the human-in-the-loop authoring/review UI that replaces that mapping script.

This needs a short ADR (**ADR-017**, mirrors ADR-016's pattern) before WS1 starts, since it sets a Phase 3/4 boundary the master spec doesn't pin down numerically. Flag this to the user before cutting WS1's first migration.

## 2. Workstream graph

```text
WS1 (Learning domain schema + content mapping)
  └─> WS2 (Learning/session APIs: Today, plan/module/lesson reads, lesson session, review scheduler)
WS3 (Design-system foundation: tokens, light theme, shared components)
  └─> WS4 (Motion-system foundation: tokens, presets, MotionSheet/Dialog, reduced motion)
        └─> WS5 (App shell + route migration + redirects + nav)  ←── also needs WS1/WS2 for real nav data later, but shell itself doesn't block on them
              ├─> WS6 (Today + Learning hub + lesson session UI)      needs WS1+WS2
              ├─> WS7 (Practice/review UI + Progress screen)          needs WS2 (+ existing Phase 2 progression tables)
              ├─> WS8 (Profile/settings + theme/light rollout)        needs WS3/WS4 + Phase 2 preference endpoints (exist)
              └─> WS9 (Existing game-mode reskin: Millionaire/Survival/Kahoot shell only)
                    └─> WS10 (A11y/perf/analytics hardening, visual regression, staged rollout, legacy-route retirement, DoD sign-off)
```

WS1/WS2 (backend) and WS3/WS4 (design/motion foundation) are independent and can run **in parallel tracks**. Everything from WS5 onward is sequential-ish and stacks like Phase 1/2 did (`phase-3/wsN-slug` branches, one PR per workstream, rebase-stack onto the previous).

## 3. Workstreams

### WS1 — Learning domain schema & content mapping — **done (2026-09-14)**
- **Branch**: `phase-3/ws1-learning-domain`
- Landed: ADR-017, `server/domains/learning/` (types/repository/in-memory + SQL adapter + contract tests, 6/6 green on in-memory+pglite), migration `0007_learning_domain` (hand-authored, verified via pglite — `drizzle-kit generate` didn't run in this env), `scripts/migrate/map-learning-content.ts`, `schemaParity` allowlist updated. Mapping logic smoke-tested against real `data/topics-db/*.json`: 17 plans / 108 modules / 460 objectives / 460 lessons, 0 duplicate ids. Full 115/115 suite (`contracts`, `server/domains`, `server/infrastructure/database`) green.
- Not yet done: actually running `migrate:map-learning-content` against a real DB (needs `DATABASE_URL` — not available in this dev environment); regenerating `meta/0007_snapshot.json` in a clean environment.
- Tables: `learning_plans`, `learning_modules`, `lessons`, `lesson_blocks` (typed/versioned per §11.3: heading, scripture-quote, explanation, glossary, image, reflection, question, summary, next-step), `objectives`, `plan_objectives`/`module_objectives` mapping.
- Migration under `server/db` + Drizzle schema, following the WS6 migration pattern (`0007`+).
- One-time/repeatable mapping script (`scripts/migrate/map-content-to-objectives.ts` or similar, mirroring `migrate:backfill-progression`) that derives plans/modules/lessons from existing `content` domain topics/questions; unmapped/unreviewed content is quarantined, not silently exposed (§21).
- **Depends on**: ADR-017 (§1 above) being written and accepted first.
- **DoD tie-in**: §25.3, §25.18 (docs/contracts synced).

### WS2 — Learning & session APIs — **done (2026-09-15)**
- **Branch**: `phase-3/ws2-learning-api`
- Landed: `contracts/api/learning.ts` (zod, mirrors `progression.ts`'s pattern); `GET /api/v1/learning/today` (`TodayView`, priority-ordered per §9.2 — `optionalChallenge` typed but never populated, no spec-defined data source); plan/module/lesson read endpoints (published-only, per WS1's schema doc comment); resumable lesson-session lifecycle (migration `0008_learning_sessions`, `lesson_sessions` table — start resumes an existing in-progress session instead of duplicating, progress/complete, no reward on completion — flagged as a deliberate gap, spec doesn't define lesson-completion reward math); server-tracked practice/review sessions (`practice_sessions` table, pinned question-revision ids so a reload doesn't re-roll and content edits mid-session can't retro-change what was shown; server computes correctness from the pinned revision instead of trusting a client `isCorrect`, unlike the legacy `/progression/answers` path — §12.1 "no answer key for future questions"); review-due scheduler is a **computed, not stored** Leitner-style ladder (`server/domains/learning/reviewScheduler.ts`, `[1,2,4,7,14,30]` day boxes) over the existing `studyMastery` map — no new scheduler table.
- Practice-session answers reuse `progressionService.applyAnswer` / the blob fallback for mastery+achievements — relocated to `server/progression/applyAnswerBlob.ts` so `/progression/answers` and Learning share one authority function instead of forking one (ties to ADR-003 as planned).
- Not yet done / flagged: **no content is actually `published` yet** — WS1's mapping script lands everything `legacy_unreviewed`, and WS2's read API only serves `published` rows by design, so `/learning/plans|modules|lessons` currently return empty/404 for all mapped content until a publish step exists (next gap before WS6 has anything to render — not invented here, flagged instead). `meta/0008_snapshot.json` has the same `drizzle-kit generate`-in-this-environment gap already tracked for 0007. No per-user timezone is stored anywhere (checked identity/preferences) — `TodayView.timezone` is UTC-only.
- Verified: 261 tests green (up from 115 at WS1) — 9 new integration tests in `server/__tests__/integration/learning.test.ts` running the full HTTP surface against pglite, including the real transactional `progressionService.applyAnswer` path (not just the blob fallback); `schemaParity` allowlist updated for `lesson_sessions`/`practice_sessions`. Root `tsc -b` has pre-existing, unrelated `framer-motion` type errors in `src/components/motion/*`/`src/pages/*` (not touched by WS2, not new).
- **Depends on**: WS1.
- **DoD tie-in**: §25.4, §25.5.

### WS3 — Design-system foundation — **code complete, pending visual QA (2026-09-15)**
- **Branch**: `phase-3/ws3-design-tokens`, PR [#19](https://github.com/DenisPoselyanov/biblegames_bot/pull/19)
- Landed: full semantic token set (§7.1/ADR-009) added to `applyCosmeticTheme()` (`src/lib/cosmeticTheme.ts`) — `deriveSemanticPalette()` generically derives all ~40 new tokens from each theme's existing 5-color `preview`, with an optional `theme.semantic` override for pinned exact values. Old 28 legacy vars untouched (dual-write, zero visual regression). `light` ("Світло") added as a 6th free `CosmeticTheme` in `src/data/cosmetics.ts` with owner-pinned ADR-009 hex values; `DEFAULT_COSMETIC_THEME_ID` still `classic` — flip is WS8. Static `:root` fallbacks in `src/index.css` alias the new token names to the already-existing classic values (no duplicated magic numbers, no drift risk). State tokens (`--state-*`) are pure static aliases to the existing theme-invariant success/danger/warning/info tokens.
- Shared components landed under `src/components/ui/` (barrel `index.ts`): `AppPage`, `PageHeader`, `SectionHeader`, `BottomNavigation` (standalone, not yet wired into `Layout.tsx` — that's WS5), `HeroCard`, `ContentCard`, `ListRow`, `SearchField`, `SegmentedControl`, `Button`/`IconButton`, `ProgressBar`/`ProgressRing`, `MetricTile`, `AchievementBadge`, `AnswerOption` (composes the existing `AnswerOptionButton` motion primitive) + `AnswerFeedback`, `ErrorState`/`OfflineState` (built on the existing `EmptyState`, not duplicated), `BottomSheet`/`Dialog` (wrap the existing `MotionSheet`/`MotionDialog`), `ThemePreview`, `AnimatedNumber`, `CelebrationLayer` (presentational only — no event-dedup, that's WS4/ADR-010's job).
- Dev-only `/dev/design-system` fixture route (`src/pages/dev/DesignSystemFixture.tsx`, gated by `import.meta.env.DEV`, tree-shaken from prod) exercises every component across all 6 themes — this repo has no Storybook equivalent.
- Verified: `tsc --noEmit` clean on every new/changed file (remaining errors are the pre-existing framer-motion type-resolution mismatch already present repo-wide before this change, see [node_modules corrupted](../../../memory/biblegames-node-modules-corrupted.md)-adjacent env issue). **Not verified**: live browser/visual QA — `npm run dev` fails in this dev environment (`Cannot find module '.../node_modules/rolldown/parseAst'`), a pre-existing corrupt install unrelated to this change. Needs `npm ci` on a clean machine, then owner review of `/dev/design-system` against the ADR-009 reference palette.
- **Independent of WS1/WS2** — built against the fixture harness, no product page migrated.
- **DoD tie-in**: §25.9, §25.10, §25.11 (partial — visual regression/owner review still pending the environment fix above).

### WS4 — Motion-system foundation — **done (2026-09-15)**
- **Branch**: `phase-3/ws4-motion-system`, PR [#20](https://github.com/DenisPoselyanov/biblegames_bot/pull/20)
- Landed: `MotionProvider`/`useMotionCapabilities` (systemReducedMotion override, intensity full/reduced/minimal, device-tier heuristic, derived particles/haptic/sound-allowed flags), event-consumption dedup (`eventDedup.ts` + `useEventOnce`), hardened `MotionSheet`/`MotionDialog` (`useBodyScrollLock`, `useOverlayDismiss`).
- Deliberately not in this PR: §7.2 directional route/tab/fullscreen presets — needs WS5's route-direction metadata first.
- **Depends on**: WS3.
- **DoD tie-in**: §25.12.

### WS5 — App shell & route migration — **done (2026-09-15)**
- **Branch**: `phase-3/ws5-app-shell`, PR [#21](https://github.com/DenisPoselyanov/biblegames_bot/pull/21), merged to `main` (`0a685ad`)
- Landed: route metadata registry (`src/lib/routes/routeMeta.ts`) driving active-tab/fullscreen decisions instead of string matching; compatibility redirects (`src/lib/routes/legacyRedirects.ts`) for every legacy path in §5.2, with a `RouteCompatibilityNotice` shown (not a silent bounce to Home) when a legacy id has no resolvable destination; route analytics (§5.3) via new `TelemetryEventName`s + `src/lib/routes/routeAnalytics.ts`; `AppShellV2` (bottom nav wired from WS3's standalone `BottomNavigation`, opacity-only route transitions matching WS4's design, offline banner, skip link, focus restoration — Telegram chrome sync and modal/sheet portals already handled elsewhere app-wide, not duplicated).
- Tab bar is the 5 primary tabs from §4.1 exactly: Today/Головна, Learn/Навчання, **Play/Гра**, Progress/Прогрес, Profile/Профіль — Practice/Review/Millionaire/Survival/Kahoot all map to the Play tab (they're listed *inside* Play's purpose in §4.1, not their own tab). A pre-merge fix corrected an initial "Practice" tab that had been reasoned only from DESIGN_RULES §14.2 in isolation, without re-checking §4.1 — caught before merge, not after.
- Feature flag: `learningShellV2` — default off, zero change to current production behavior (same dual-write pattern as WS3/WS4); `App.tsx` has two parallel `<Routes>` trees gated on the flag.
- New canonical routes (§5.1) without a real WS6-9 implementation render a `ComingSoon` placeholder; routes with an existing equivalent (Learn→StudyHub, Progress→ProgressDashboard, Play/Shop/Social/game modes) reuse it directly.
- Verified: `tsc -b` clean, 405/405 tests (10 new), `eslint` clean on changed files, live browser QA (all 5 tabs incl. the Play-tab fix, silent + failed-mapping redirects, fullscreen nav-hiding on kahoot room).
- **Depends on**: WS3, WS4.
- **DoD tie-in**: §25.1, §25.13.

### WS6 — Today + Learning hub + lesson flows — **code complete (2026-09-16)**
- **Branch**: `phase-3/ws6-today-learn-lesson`, PR [#22](https://github.com/DenisPoselyanov/biblegames_bot/pull/22) — started stacked on `phase-3/ws5-app-shell` (worktree `biblegames_bot-ws6`), retargeted to `main` + rebased once WS5 merged mid-WS6 (a concurrent session merged #21 while this one was implementing)
- Two decisions made before implementation: (1) no bulk-publish of WS1's `legacy_unreviewed` content — WS6 ships against the real published-only contract and will render empty/404 states in prod until Phase 4 publishes something; test fixtures seed published rows to prove the populated path. (2) reuses the pre-existing `today_dashboard`/`learning_plans`/`lesson_experience_v2` flags instead of the plan doc's `todayV1`/`lessonRendererV1` — each gates one new v2-only page component via a per-route ternary in `App.tsx` that falls back to the exact prior element (`Home`/`StudyHub`/`ComingSoon`) when off, so `Home.tsx`/`ThemeDetail.tsx`/`StudyHub.tsx` (which separately read some of these same flags for unrelated v1 sections) are untouched — verified zero-regression live with flags off.
- **Server**: new `GET /api/v1/learning/search?q=&testament=&limit=` (§10.2) — ILIKE over published `learning_plans`/`learning_objectives` title/description(+topicPath), `q` 2-100 chars, limit ≤20; `GET /plans` gained an optional `?testament=` filter. New nullable `testament` column (migration `0009_learning_testament.sql`) on both tables — ships unpopulated, same "content-ops fills it later" shape as `status`; no OT/NT data exists yet so the filter is real plumbing with nothing to filter until Phase 4 tags content.
- **Client**: `src/repos/learningRepo.ts` + `src/queries/useLearning.ts` (React Query hooks); five new pages under `src/pages/learn/` (Today, LearningHub, PlanDetail, ModuleDetail, LessonSession) replacing the `/`, `/learn`, `/learn/plans/:id`, `.../modules/:id`, `/learn/lessons/:id` v2 route elements; `src/components/learn/LessonBlockRenderer.tsx` — lookup-table dispatch over `lessonBlockPayloads.ts` (one zod schema per §11.3 block type), unknown type or invalid payload logs + falls back safely instead of crashing the lesson.
- Known gaps, not invented around: `PlanDetail`/`ModuleDetail` show structure only, no completion/mastery/progress bar — `PlanDetail`/`ModuleDetail` contracts carry no per-user aggregation and WS2 doesn't compute one (same "don't fabricate" rule as `optionalChallenge`/estimated effort); a per-user plan-progress endpoint is a natural WS7-adjacent follow-up. Module/lesson unlock state is exactly what the server returns (none today) — no client-side lock heuristic invented.
- **Verified**: `tsc -b` (client) and `tsc -p server/tsconfig.json` both clean; `eslint` clean on all changed/new files (caught and fixed one real `react-hooks/set-state-in-effect` violation in `LessonSession.tsx`); full suite 432/432 passing (one unrelated `rbac.test.ts` timeout confirmed flaky under full-suite load, passes in isolation). **No React-component-rendering test harness exists in this repo** (no `@testing-library/react`/jsdom; `vitest.config.ts` only discovers `*.test.ts`) — component logic that needed testing was split into plain `.ts` modules (`lessonBlockPayloads.ts`) instead; page rendering itself is covered by live browser QA, not a unit test, correcting the plan's original assumption of an existing Testing Library convention. Live QA: dev server run with `learningShellV2` + all three WS6 flags on — Today/LearningHub/PlanDetail/ModuleDetail/LessonSession all render their error/empty states correctly against no backend (no crashes, clean console); search debounce + URL deep-linking (`?q=`, `?testament=`) confirmed; a second instance with only `learningShellV2` on (WS6 flags off) confirmed `Home`/`StudyHub`/`ComingSoon` are pixel-identical to pre-WS6.
- Environment note: this dev environment's `node_modules` operations (delete/copy) are extremely slow via plain `cp`/`Remove-Item` (~matches the earlier "~2h npm ci" precedent) — `robocopy /MT` from the sibling worktree was dramatically faster for populating a new worktree's `node_modules` from one with an identical lockfile.
- **Depends on**: WS1+WS2 (data), WS3–5 (shell/components/motion).
- **DoD tie-in**: §25.2, §25.3, §25.4.

### WS7 — Practice/review UI + Progress screen — **code complete (2026-09-16)**
- **Branch**: `phase-3/ws7-practice-progress`, off `main` at `299bfbf` (post-WS6 merge).
- Server needed **zero changes** — WS2 already shipped `POST /practice-sessions`, `.../answers` and `GET /review/due` with full contracts; this workstream is client-only.
- Flag decision: a single new `practiceSessionV2` flag gates all three routes (`/practice`, `/practice/session/:sessionId`, `/review`) together, not one reused dead flag per route like WS6 did — Review launches a practice session, so the two features are genuinely coupled and must ship/flip atomically or the review list would link into a broken ComingSoon session screen. `progress_dashboard_v2` (pre-existing, previously dead — same overlap pattern as WS6) gates the new `/progress` route; it has no such coupling.
- **Client**: `learningRepo`/`useLearning.ts` gained `createPracticeSession`/`answerPracticeSession`/`getReviewDue`. `PracticeIntent` (`/practice`) drills plan → module → lesson (reusing WS6's existing plan/module read hooks — no flat objective-list endpoint exists) then creates a `mode: 'practice'` session. `ReviewHub` (`/review`) lists due cards from WS2's scheduler and creates a `mode: 'review'` session per item. `PracticeSession` (`/practice/session/:sessionId`) runs the question loop with `AnswerOption`/`AnswerFeedback` (§12.3/§12.4 — no color-only state, no routine confetti; `CelebrationLayer` only fires when `achievementsGranted` is non-empty). `ProgressV2` (`/progress`) reads `useResolvedProfile()` (the same ADR-016-backed store the legacy dashboard already reads — not a new computation) for rank/streak/mastery-count/achievements, plus the new review-due count and Today's `recentOutcome`/`activeLesson`.
- Known gap, not invented around: WS2 exposes no `GET` for an existing practice session, so `PracticeSession` is seeded once from a React Query cache entry the launching page writes before navigating — a hard reload of `/practice/session/:id` cannot resume and shows an explicit "start a new session" state instead of fabricating one. "Mistakes" mode (§12.1's third mode) has no entry point — there is no mistake-queue data source (no endpoint lists a user's missed questions), so only `practice`/`review` are wired; same "don't fabricate a data source" rule as WS6's `optionalChallenge`. `ProgressV2`'s objective/module-progress section links into Learn instead of a fake completion bar — same gap `PlanDetail`/`ModuleDetail` already flagged, still not resolved (no per-user aggregation endpoint exists yet).
- **Verified**: `tsc -b` (client) and `tsc -p server/tsconfig.json` both clean; `eslint` clean on all new/changed files; full suite 430/432 (the same pre-existing `rbac.test.ts` flake WS6 already documented, unrelated). Live browser QA was attempted but blocked by two stacked environment issues discovered along the way, not by this workstream's code: (1) `.claude/launch.json`'s dev port (5199) isn't in the server's default `CLIENT_ORIGINS` (5173 only) — worked around locally with `CLIENT_ORIGINS=http://localhost:5199`; (2) once CORS was fixed, the Claude Code Browser pane was host-side backgrounded (`document.hidden`/pane "currently hidden") for the rest of the session, which throttles the JS retry-backoff timers `apiClient`/React Query rely on, so queries never settled — confirmed via `plans.fetchStatus: 'paused'` and the browser tool's own timeout message ("The Browser pane is currently hidden... a promise that never settles"). Correctness instead rests on: a direct in-page `learningRepo.listPlans()` call rejecting correctly and immediately with the real 404 (proving the repo/contract layer is right), the full test suite (including WS2's server-side integration tests for the exact `/practice-sessions` and `/review/due` endpoints this workstream's client calls), and line-by-line structural parity with WS6's already-merged, already-reviewed hook/loading/error/empty-state conventions.
- **Depends on**: WS2 (scheduler/session endpoints), existing Phase 2 progression tables.
- **DoD tie-in**: §25.5, §25.6, §25.7.

### WS8 — Profile/settings + theme rollout — **code complete (2026-09-16)**
- **Branch**: `phase-3/ws8-profile-theme-rollout`, PR [#24](https://github.com/DenisPoselyanov/biblegames_bot/pull/24).
- Two flags: `profileSettingsV2` (new Profile/Settings/Themes screens) and one flag
  `lightThemeDefault` for the default-theme flip — deliberately not the spec's suggested second
  `rebrandThemeV2`, since WS3 already shipped the underlying tokens unconditionally.
- **Theme default flip**: `resolveDefaultCosmeticThemeId()` (`src/data/cosmetics.ts`) swapped in at
  every `DEFAULT_COSMETIC_THEME_ID` fallback read site (`main.tsx`, `CosmeticThemeSync`,
  `VantProvider`, `usePreferences`, `profileMigrations.fillDefaults`, `cosmeticTheme.ts`'s
  invalid-id fallback — 6 sites total, one (`VantProvider`) found only during this workstream, not
  in the original WS3/WS4 sweep). No backfill/migration needed — the existing fallback-only-on-unset
  design already satisfies "existing user choice remains" by construction; only genuinely-new
  profiles see the new default. Fixed a real pre-existing gap while there: `?? DEFAULT_...` doesn't
  catch `''` (the server's `emptyProfile().activeTheme`), only `null`/`undefined` — switched those
  sites to `||`. Also fixed: `sanitizePreferences`/`usePreferences.setActiveTheme` required a theme
  to already be in `unlockedThemes` even for `price: 0` catalog themes (`light` included) — a real
  theme selection was silently rejected for `light` no user had ever been granted an entitlement
  for. Now any `price === 0` catalog theme is always selectable.
- **Server**: extended `contracts/api/me.ts` `preferencesRequest` +
  `profileService.ts` (`sanitizePreferences`/`writePreferences`/`readProfile`) to whitelist
  `locale`/`timezone`/`motionIntensity` — the repository layer (`PreferencesRecord`/
  `PREFERENCE_KEYS`) and SQL columns already existed from Phase 2, just weren't wired through the
  contract/service layer yet.
- **New pages** (`src/pages/profile/`): `ProfileV2.tsx` (full §14.1 reskin — header/rank card/nav
  rows into Settings/Themes/Communities/Shop/Progress, stats grid + achievements ported from the
  legacy page; mastery-map/theme-progress list deliberately NOT duplicated, links to WS7's
  `/progress` and Learn instead of a second competing view), `Settings.tsx` (§14.2 groups — real
  plumbing for account/translation/theme/motion-intensity/privacy; locale/notifications/text-size/
  data-export/logout render as visible disabled "Скоро" rows per user decision, not hidden or
  fabricated), `ThemePicker.tsx` (`/profile/themes` grid, unowned paid themes route to `/shop`
  instead of a fake local purchase per ADR-009).
- Legacy `src/pages/Profile.tsx` completely untouched — still serves the v1 tree and the v2
  flag-off fallback.
- **Verified**: `tsc -b` + `tsc -p server/tsconfig.json` clean; `eslint` clean (only the
  pre-existing `socialVersion` escape-hatch warning, same pattern as the legacy page already had);
  full suite 438/438 (4 new tests added: 2 for the WS8 preference fields round-trip + free-theme
  selectability in `preferencesCutover.test.ts`, 2 for `resolveDefaultCosmeticThemeId()` flag
  on/off in `src/data/cosmetics.test.ts`). **Live browser QA** (dev server, `.env.local` flags) —
  all 4 scenarios (flags off / `profileSettingsV2` only / `lightThemeDefault` only on a cleared
  profile / both together) confirmed correct, including live theme-switch round-trip
  (classic ↔ light) and motion-intensity persistence across reload. QA caught and fixed 2 real bugs
  a clean typecheck had missed: a missing `ThemePicker.module.css` file (TS can't verify CSS module
  files exist on disk) and a copy/data bug where "Мова інтерфейсу" showed the Bible-translation
  label instead of "Українська".
- **Not done**: `index.html`'s static
  `<meta name="color-scheme">`/`theme-color` deliberately left at the dark/classic default —
  intentional, revisit at full-rollout time when `FLAG_DEFAULTS.lightThemeDefault` actually flips.
- **Depends on**: WS3/WS4, Phase 2 preference endpoints (already existed, just needed wiring).
- **DoD tie-in**: §25.8, §25.9, §25.10.

### WS9 — Existing game-mode reskin — **MERGED [#25](https://github.com/DenisPoselyanov/biblegames_bot/pull/25) (2026-09-16), main `1c050f7`**
- **Branch**: `phase-3/ws9-game-mode-reskin`
- Verified the flagged bug: both Millionaire *and* Survival trusted a client-submitted `score`/
  `reachedLevel`, only range-clamping it — fixed by having the client submit a per-question answer
  trail and the server replay it against the real answer key; also corrected two adjacent
  reward-accuracy bugs (server was paying a flat rate, not Millionaire's real per-level table or
  Survival's real difficulty-weighted points). Play Hub cards now disclose solo/group, duration,
  reward policy, mastery impact, availability (§15.1). Kahoot's 7 non-Hub screens gained
  `FullscreenMotion`/`MotionStagger` (§15.4) — purely additive, no realtime logic touched.
  Millionaire/Survival's "shared shell" was assessed as already adequately met (WS4 motion +
  semantic tokens already in place) and not force-converted to `components/ui/*`.
- **§15.5 (social/shop preview shell) — done as a WS9 follow-up** (branch `phase-3/ws9-social-shop-shell`,
  not yet merged): Shop, GlobalStats, Challenges, ChallengeDetails, Communities, CommunityDetails all
  rewrapped in `AppPage`/`PageHeader` (+ `ErrorState` for the two not-found branches), converging them on
  the same shell as the Learn/Practice hubs. Also fixed two pre-existing §15.5 violations found during the
  pass (not introduced by WS9): `GlobalStats.tsx` hardcoded four fictional players (`VIRTUAL_PLAYERS`) into
  the ranking — removed, ranking now honestly shows only the real profile with copy explaining the global
  leaderboard isn't backed yet; `CommunityDetails.tsx` rendered a "Лідерборд" section that was pure zeros
  (`score:0, gamesPlayed:0`) with raw ids as display names — removed rather than faked.
- **Depends on**: WS3/WS4/WS5.
- **DoD tie-in**: §25.17 (no client-authoritative rewards reintroduced).

### WS10 — Hardening, rollout, DoD sign-off — **in progress**
- **Branch**: `phase-3/ws10-hardening-rollout` (a11y work split onto `phase-3/ws10-a11y-gold-contrast`,
  not yet merged)
- Accessibility audit (§17: touch targets, focus, contrast incl. gold-on-ivory, reduced motion, ARIA live dedup).
  - **Gold-on-ivory contrast fixed** for the new semantic-token layer: added `accentSpiritualText`
    (`--accent-spiritual-text`), a WCAG-safe darkened variant of `accentSpiritual` for text/icon roles only,
    pinned to `#816322` for the `light` theme (~5.1:1/~5.6:1 vs bgApp/bgElevated; original `#C59A3D` was only
    ~2.37:1). Wired into `PageHeader`/`AchievementBadge`/`HeroCard`/`MetricTile`.
  - **Found but deferred**: the same bug exists in ~62 places across 21 pre-WS3 files using the legacy
    `--gold-light` token directly (Millionaire, Survival, Kahoot, Quiz, Home, Profile, etc.) — flagged as a
    separate background task (`task_7ea52d9a`), not yet started.
  - **Touch-target sweep done**: audited every `src/components/ui/*` primitive's clickable-element
    dimensions (the only ones exercised by real WS6-9 pages, not just the dev fixture) against the 44×44
    CSS px floor. Found and fixed 3 violations, all below 44px on core interactive elements: `Button`'s
    `sm` variant (40px — used by `ErrorState`/`OfflineState`'s retry button and `RouteCompatibilityNotice`,
    both real error-path UI), `SearchField`'s clear button (32×32 — used on `LearningHub`'s search), and
    `SegmentedControl`'s per-option hit area (40px — same `LearningHub` filter). `IconButton` (44×44),
    `ListRow`/`BottomNavigation` (56px rows, decorative sub-icons only) were already correct. Verified via
    `tsc -b` clean, full suite 434/434, and live browser QA on `/dev/design-system` (light theme) confirming
    the enlarged clear button and segmented control render correctly with no layout breakage.
  - **Focus-visible audit done**: global `button/a/input/select:focus-visible` outline in `src/index.css`
    covers everything; every `components/ui/*` primitive with an `onClick` renders a real `<button>` (never
    a clickable `<div>`/`role="button"` — confirmed via grep, zero hits), so nothing bypasses native focus
    handling. The few `outline: none` overrides (`SearchField` input, `AppShellV2` `<main>`) each have a
    working visible replacement (focus-within ring, or are the deliberate route-focus target) — not gaps.
  - **Still open**: text-scaling-to-200% check, ARIA live regions (currently only 1 occurrence app-wide,
    admin-only — ARIA live is essentially greenfield for core screens), route/dialog-heading focus
    management (`AppShellV2` already moves focus to `<main>` on route change via `mainRef`, but not to the
    new screen's heading specifically per §17's wording; `useFocusTrap` focuses first interactive element,
    not the heading, inside dialogs/sheets).
  - Motion reduced/minimal (already verified real/wired, not a stub — `MotionProvider.tsx`) and most
    icon-button `aria-label` coverage (via `IconButton`, already required-prop) need no further work.
- Performance budget (§18: no full question-bank load on core routes, code-split, image/font budget) — **not started**.
- Analytics instrumentation (§19) and privacy checks (no raw Scripture-reflection tracking) — **not started**.
- Full test suite: unit/component, integration, E2E/manual matrix (§23), visual regression baseline for the screens listed in §23 — **not started**.
- Staged flag rollout per §20 (fixtures → design review → shell-behind-flag → migrated internal users → alpha → new-users-first if migration risk high → percentage → full → remove old shell after window), redirect retirement only after the retention window (§5.3) — **not started, needs product-owner/production-ops decisions this agent can't make alone**.
- Rollback drill per §26; Phase 4 handoff doc per §27.
- **DoD tie-in**: closes §25 items 14–19.

## 4. Sequencing recommendation

1. Land **ADR-017** (Phase 3/4 Learning-domain boundary) — short, needs your sign-off before WS1's migration is written.
2. Start **WS1+WS2** (backend) and **WS3+WS4** (design/motion foundation) as two parallel stacks.
3. Merge WS5 once WS3/WS4 land; it doesn't need to wait on WS1/WS2.
4. WS6/WS7/WS8/WS9 stack on WS5, each behind its own flag, roughly in the order listed (Today first — it's the product's front door).
5. WS10 closes the phase.

## 5. Risks / things to flag as they surface

- **Content-mapping coverage**: if a large fraction of existing themes/questions can't be cleanly mapped to objectives/modules, Learn will launch thin. Worth a quick dry-run count early in WS1, same way `migrate:backfill-progression --dry` was used in Phase 2.
- **Review scheduler is new, not existing** — `ReviewQueue.tsx` today likely has no real due-date algorithm to consume; confirm expected algorithm (simple due-window vs anything FSRS-like, which is explicitly Phase 8 scope per `PHASE_8`) before WS2 locks the contract.
- **Survival's client-submitted score** — flagged above under WS9; verify during WS1/WS2 exploration whether this is already fixed by Phase 1/2's server-authoritative completions or still open.
- Ten workstreams is more than Phase 1 (4) or Phase 2 (6); consider merging WS7+WS8 or WS9 into a neighbor if stacked-PR review load gets heavy. Phase 1/2 both hit stacked-PR/CI merge gotchas worth re-checking before WS1 branches off `main`.
