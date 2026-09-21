# Bible Games — статус канонічних фаз

> Канонічний порядок визначає [BIBLE_GAMES_MASTER_SPECIFICATION.md](./BIBLE_GAMES_MASTER_SPECIFICATION.md). Детальні execution-плани знаходяться в [`phases/`](./phases/README.md). Стек, MVP, domain boundaries і open-source reference rules уточнює [OPEN_SOURCE_REFERENCE_ARCHITECTURE.md](./OPEN_SOURCE_REFERENCE_ARCHITECTURE.md).

| Phase | Назва | Статус | Детальний план |
|---:|---|---|---|
| 0 | Canonical Documentation and Verified Baseline | completed — canonical docs migrated; reference architecture and GitHub search guide indexed | [Phase 0](./phases/PHASE_0_CANONICAL_DOCUMENTATION_AND_BASELINE.md) |
| 1 | Production Safety & Engineering Foundation | **completed (2026-09-07)** — WS1 (env validation, hardened Telegram initData verifier, typed principal, fail-closed HTTP + Socket auth, `createApp()` split, request-id + error envelope, Vitest + CI gates); WS2 (config-sourced RBAC, policy middleware, isolated + audited `/api/admin/questions`, append-only audit log, self-scoped `/api/v1/me/*`); WS3 (immutable wallet ledger + idempotency, server-authoritative `POST /api/v1/progression/completions` with stable `eventId`, preference/progression write split, one-time bounded migration, atomic JSON adapter); WS4 part 1 (practice-track + mastery + global-stats authority, `/progression/answers`, `/shop/purchases`, `/me/learning-state`; React client cutover); **WS4 part 2 (all rollout break-glass flags + legacy `x-user-id` / `PUT /profile` / `telegramAuth.ts` / dead `storage.ts` removed; in-memory rate limiting §13; structured logs + metrics + health/live+ready §16; demo routes isolated to non-production; DoD sign-off §23)**. `npm run check` green, 146 tests. | [Phase 1](./phases/PHASE_1_PRODUCTION_SAFETY_AND_ENGINEERING_FOUNDATION.md) |
| 2 | Core Architecture & Authoritative Data Platform | **DoD §26.1: 17/17 fully met** (2026-09-10). 5 stacked workstreams + WS6 decomposition; stack = Zod + Drizzle + pg-boss (ADR-012/013/014/016 accepted, ADR-015 object storage). **WS1–WS4 merged** (PRs #8 `b4d0a34`, #9 `009c5a2`, #10 `1ca59bd`, #11 `f25eca5`): `contracts/` runtime schemas + `validateBody` + §7.5 error envelope + port-free `createHttpServer`; Drizzle persistence + migration framework + identity/RBAC + persisted `RoleResolver` + shared rate-limit store; canonical `question_revisions` + `CANONICAL_CONTENT_REPOSITORY` cutover + realtime gateway v2 (`REALTIME_GATEWAY_V2`); frontend typed API client + query-key factory + provider decomposition + `PlayerContext` retired. **WS5** (`phase-2/ws5-jobs-storage-deploy`): background `JobQueue` + worker + retention sweeps (ADR-014; durable pg-boss adapter deferred, in-memory default); `ObjectStore` filesystem/S3 adapters + `content.snapshot` job (ADR-015); `docs/DEPLOYMENT.md` + `docs/OBSERVABILITY.md` + `docs/ROLLOUT_PHASE_2.md`; HTTP/DB metrics + frontend error reporting; typed `user_preferences` cutover + `LEGACY_STORE_READONLY` + backfill script. **WS6** (`phase-2/progression-decomposition`, ADR-016, 2026-09-10): progression + entitlement decomposed into typed `progression_state` / `achievement_grants` / `player_theme_stats` / `entitlements` tables (migrations 0004–0006), transactional reward hot path (`db.transaction` + `FOR UPDATE`), `legacyBlobMirror` dual-write behind `LEGACY_PROGRESSION_READONLY`, `migrate:backfill-progression` + provenance/verification, and `productionValidation.ts` retires `STORAGE_PROVIDER=json` — closes DoD #6/#7/#9. Server-side verified (330 tests); full `npm run check` pending a clean `npm ci` (local node_modules corrupted, unrelated). **Rollout (ROLLOUT_PHASE_2 §2.6): steps 12–13 done against prod Supabase 2026-09-10** — chain `0000`–`0006` applied (journal 7/7, all 27 tables, roles seeded), backfill run + `--verify-only` `countsMatch`/`sumsMatch` `true` (DB greenfield — 0 real rows). Steps 14–15 (parity window + `LEGACY_PROGRESSION_READONLY`) await a live deployment against this DB. | [Phase 2](./phases/PHASE_2_CORE_ARCHITECTURE_AND_DATA_PLATFORM.md) |
| 3 | Learning Product, MVP, Rebrand & Motion | **DoD §25: 17/19 met, 2 non-agent-completable (2026-09-21).** WS1–WS9 code-complete/merged (see `.claude/plans/phase-3-learning-shell-rebrand.md` for full per-workstream evidence). **WS10 close-out** (`phase-3/ws10-rollout-closeout`, stacked on PR [#29](https://github.com/DenisPoselyanov/biblegames_bot/pull/29)): a11y (§17: contrast incl. a follow-up sweep closing the deferred `--gold-light` text/icon contrast gap across 21 files/62 declarations, touch targets, focus-visible, route-heading focus, text-scaling-to-200%, ARIA live), performance (§18: code-splitting, lazy question-bank loading, render-blocking font fix, bundle-boundary + perf-budget CI gate), analytics (§19: 8/8 spec categories instrumented, payload allowlisting) all closed in earlier WS10 PRs. This close-out additionally: closed 2 of §23's unit-test gaps (`eventDedup.test.ts`, `motionCapabilities.test.ts` — the latter required extracting `MotionProvider`'s inline capability derivation into a pure, testable function since this repo has no React-component-rendering harness); **flipped all 8 rollout flags to their full-rollout default in code** (`learningShellV2`, `today_dashboard`, `learning_plans`, `lesson_experience_v2`, `practiceSessionV2`, `progress_dashboard_v2`, `profileSettingsV2`, `lightThemeDefault` — see [ROLLOUT_PHASE_3.md](./ROLLOUT_PHASE_3.md)), a product-owner decision made in place of §20's live staged-percentage rollout, which needs production metrics/ops access this repo's agent doesn't have; verified rollback live (flags off → legacy 4-tab shell renders correctly) and the flag flip itself (fresh load → v2 shell + light theme, no `.env.local` overrides). **Known, explicitly-not-hidden gaps** — full detail in [PHASE_3_TO_4_HANDOFF.md](./phases/PHASE_3_TO_4_HANDOFF.md): (§25.2) no learning content is `published` yet, so the live v2 screens are correct but empty until Phase 4 ships a publish step; (§25.14) no real-device Telegram Android/iOS verification, only emulated mobile widths — deferred to Phase 7; (§25.16) **no visual regression suite exists in this repo at all** — never built, not a Phase 3 regression, a fresh tooling decision needed later; (§23 "AnswerOption states") the one remaining required unit-test item with no non-component way to cover it absent a rendering harness; (§25.19) product-owner sign-off is, by construction, not agent-completable — pending. | [Phase 3](./phases/PHASE_3_LEARNING_PRODUCT_REBRAND_AND_MOTION.md) |
| 4 | Content Quality, Reviewed AI Pipeline & Content Studio | planned; blocked by Phase 2–3 — authoring, revisions, validation, queue, media proposals, human review і atomic publication | [Phase 4](./phases/PHASE_4_CONTENT_AI_AND_CONTENT_STUDIO.md) |
| 5 | Social, Groups, Challenges & Multiplayer | planned — private communities і async challenges спочатку; persistent/reconnectable Kahoot після них | [Phase 5](./phases/PHASE_5_SOCIAL_GROUPS_CHALLENGES_AND_MULTIPLAYER.md) |
| 6 | Economy, Shop, Entitlements & Monetization | planned; monetization model not selected — immutable ledger, entitlements і no-pay-to-win | [Phase 6](./phases/PHASE_6_ECONOMY_SHOP_ENTITLEMENTS_AND_MONETIZATION.md) |
| 7 | Performance, Offline, Accessibility & Public Release | planned — offline capability matrix, media/CDN, accessibility, observability, load tests і release gates | [Phase 7](./phases/PHASE_7_PERFORMANCE_OFFLINE_ACCESSIBILITY_AND_RELEASE.md) |
| 8 | Expansion and Bonus Capabilities | optional future — advanced adaptive learning/FSRS, Church/Classroom, bounded AI assistant та інші owner-approved options | [Phase 8](./phases/PHASE_8_EXPANSION_AND_BONUS_CAPABILITIES.md) |

## Canonical MVP

Перший production MVP завершується всередині Phase 3 після виконання залежностей Phase 1–2. Він має довести один повний server-authoritative цикл:

```text
published lesson
→ checkpoint
→ practice session with frozen question revisions
→ feedback and explanation
→ mistake review
→ objective mastery
→ progress dashboard
```

У цей MVP входить «Мільйонер» як перша гра на спільному Question Runtime. Live Kahoot, відкриті communities, Stars/Premium, user-facing AI chat, full offline rewards і Redis-based horizontal realtime не є MVP blockers.

## Важливе розмежування

Старий `docs/product-rebuild/MASTER_ROADMAP.md` мав іншу нумерацію Phase 0–13. Його Phase 0–7 були реалізовані в коді й залишаються частиною актуального baseline, але **не означають**, що канонічні Phase 0–7 завершені. Відповідність і правила переходу описані в [ROADMAP_MIGRATION.md](./ROADMAP_MIGRATION.md).

## Binding domain-документи

- [OPEN_SOURCE_REFERENCE_ARCHITECTURE.md](./OPEN_SOURCE_REFERENCE_ARCHITECTURE.md) — stack, modular monolith, Question Bank/Runtime, Lesson Blocks, MVP, reference repos і search guide.
- [PHASE_3_REBRANDING_AND_THEME_SYSTEM.md](./PHASE_3_REBRANDING_AND_THEME_SYSTEM.md)
- [DESIGN_RULES.md](./DESIGN_RULES.md)
- [MOTION_SYSTEM.md](./MOTION_SYSTEM.md)
- [MONETIZATION_STRATEGY.md](./MONETIZATION_STRATEGY.md)
- [FUTURE_UPGRADE_OPTIONS.md](./FUTURE_UPGRADE_OPTIONS.md) — лише каталог кандидатів, не roadmap.

## Reference rule

Oppia, H5P, Moodle, ClassQuiz, Anki/FSRS, Frappe Learning, Kolibri й AndBible є архітектурними референсами, а не dependencies. Будь-яке копіювання коду потребує окремої license review; за замовчуванням патерн реалізується нативно в поточному React/TypeScript/Express/PostgreSQL стеку.

Статус `completed` дозволено встановити тільки після виконання acceptance criteria, migrations, tests, rollout/rollback і наявності evidence у коді.
