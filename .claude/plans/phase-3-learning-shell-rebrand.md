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

### WS2 — Learning & session APIs
- **Branch**: `phase-3/ws2-learning-api`
- `GET /api/v1/learning/today` → `TodayView` contract (§9.1), priority-ordered (§9.2), all states in §9.3.
- Plan/module/lesson read endpoints + lesson session start/progress/complete (idempotent, event-authoritative per §11.4).
- Review scheduler contract + due-items endpoint (§12.5) — `ReviewQueue.tsx` currently has no server scheduler to consume; this is new, not a wire-up.
- Practice/review session create+answer: extend/reuse Phase 1/2 `/progression/completions` & `/progression/answers` rather than forking a parallel authority path (§12.1–12.2, ties to ADR-003).
- **Depends on**: WS1.
- **DoD tie-in**: §25.4, §25.5.

### WS3 — Design-system foundation
- **Branch**: `phase-3/ws3-design-tokens`
- Semantic tokens (§7.1) implementing ADR-009: surfaces, text, brand, accent, borders, semantic states, CTA, progress, nav, overlay, shadow/elevation, focus, skeleton.
- Theme schema (§7.2) + `light` theme asset set + default-theme migration rules (§7.3) — but the *flip* to default happens in WS8's rollout, not here; WS3 only builds the theme and keeps `classic` as-is.
- Shared components (§7.4): `AppPage`, `PageHeader`, `SectionHeader`, `BottomNavigation`, `HeroCard`, `ContentCard`, `ListRow`, `SearchField`, `SegmentedControl`, buttons, `ProgressBar`/`ProgressRing`, `MetricTile`, `AchievementBadge`, `AnswerOption`/`AnswerFeedback`, `Skeleton`, Empty/Error/Offline states, `BottomSheet`/`Dialog`, `ThemePreview`, `AnimatedNumber`, `CelebrationLayer`.
- **Independent of WS1/WS2** — build against fixtures/storybook-style harness first.
- **DoD tie-in**: §25.9, §25.10, §25.11.

### WS4 — Motion-system foundation
- **Branch**: `phase-3/ws4-motion-system`
- Implements ADR-010: motion tokens/easings, one package (`framer-motion`), route/tab/fullscreen presets, hardened `MotionSheet`/`MotionDialog` (focus/scroll/back handling), reduced/minimal motion support + low-end capability hook, event-consumption dedup (so a level-up doesn't replay on remount/reload — §13 "Level and rank"), shared progress/number/celebration primitives.
- **Depends on**: WS3 (uses the same semantic state colors for motion cues).
- **DoD tie-in**: §25.12.

### WS5 — App shell & route migration
- **Branch**: `phase-3/ws5-app-shell`
- New route model + compatibility redirects for every legacy path in §5.2, route-metadata-driven fullscreen/tab logic (not string matching in `Layout.tsx`), route analytics (§5.3).
- App shell (§6): safe-area, Telegram header/background sync, bottom nav, transition container, toast/offline banner, modal/sheet portals, focus restoration.
- Feature flag: `learningShellV2`.
- **Depends on**: WS3, WS4.
- **DoD tie-in**: §25.1, §25.13.

### WS6 — Today + Learning hub + lesson flows
- **Branch**: `phase-3/ws6-today-learn-lesson`
- Today screen (§9) behind `todayV1`; Learning hub with search/filters (§10) — server-side search, not client-side full-JSON scan; Plan/Module/Lesson flows (§11) behind `lessonRendererV1`, rendering typed lesson blocks with safe fallback on unknown block type.
- **Depends on**: WS1+WS2 (data), WS3–5 (shell/components/motion).
- **DoD tie-in**: §25.2, §25.3, §25.4.

### WS7 — Practice/review UI + Progress screen
- **Branch**: `phase-3/ws7-practice-progress`
- Practice/review session UI (§12) behind `practiceSessionV2`: session creation by intent, answer submission with idempotency key, correct/wrong feedback per §12.3–12.4 (no color-only signaling, no routine confetti), mistake queue (§12.6).
- Progress screen (§13) behind `progressViewV2`: completion vs mastery vs review-health vs streak vs XP/rank as distinct sections, no duplicate level-up replay on reload.
- **Depends on**: WS2 (scheduler/session endpoints), existing Phase 2 progression tables.
- **DoD tie-in**: §25.5, §25.6, §25.7.

### WS8 — Profile/settings + theme rollout
- **Branch**: `phase-3/ws8-profile-theme-rollout`
- Profile/settings screens (§14) behind `profileSettingsV2`, using bounded Phase 2 preference endpoints (`/me/preferences`) — no new whole-profile writes.
- `Світло` becomes default for new/invalid profiles behind `lightThemeDefault`/`rebrandThemeV2`, preserving existing user choice and entitlements (§7.3, §21 migration rules); startup fallback is `light`, never a dark→light flash.
- **Depends on**: WS3/WS4, Phase 2 preference endpoints (already exist).
- **DoD tie-in**: §25.8, §25.9, §25.10.

### WS9 — Existing game-mode reskin
- **Branch**: `phase-3/ws9-game-mode-reskin`
- Play Hub cards disclose mastery/XP/leaderboard impact per mode (§15.1). Millionaire/Survival/Kahoot get shared shell/typography/motion only — **no reward-authority changes**; Survival stops trusting client-submitted final score as authoritative if it currently does (verify — this may itself be a Phase 1/2-adjacent bug worth flagging separately if found).
- **Depends on**: WS3/WS4/WS5.
- **DoD tie-in**: §25.17 (no client-authoritative rewards reintroduced).

### WS10 — Hardening, rollout, DoD sign-off
- **Branch**: `phase-3/ws10-hardening-rollout`
- Accessibility audit (§17: touch targets, focus, contrast incl. gold-on-ivory, reduced motion, ARIA live dedup).
- Performance budget (§18: no full question-bank load on core routes, code-split, image/font budget).
- Analytics instrumentation (§19) and privacy checks (no raw Scripture-reflection tracking).
- Full test suite: unit/component, integration, E2E/manual matrix (§23), visual regression baseline for the screens listed in §23.
- Staged flag rollout per §20 (fixtures → design review → shell-behind-flag → migrated internal users → alpha → new-users-first if migration risk high → percentage → full → remove old shell after window), redirect retirement only after the retention window (§5.3).
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
