# Bible Games — статус канонічних фаз

> Канонічний порядок визначає [BIBLE_GAMES_MASTER_SPECIFICATION.md](./BIBLE_GAMES_MASTER_SPECIFICATION.md). Детальні execution-плани знаходяться в [`phases/`](./phases/README.md). Стек, MVP, domain boundaries і open-source reference rules уточнює [OPEN_SOURCE_REFERENCE_ARCHITECTURE.md](./OPEN_SOURCE_REFERENCE_ARCHITECTURE.md).

| Phase | Назва | Статус | Детальний план |
|---:|---|---|---|
| 0 | Canonical Documentation and Verified Baseline | completed — canonical docs migrated; reference architecture and GitHub search guide indexed | [Phase 0](./phases/PHASE_0_CANONICAL_DOCUMENTATION_AND_BASELINE.md) |
| 1 | Production Safety & Engineering Foundation | **completed (2026-09-07)** — WS1 (env validation, hardened Telegram initData verifier, typed principal, fail-closed HTTP + Socket auth, `createApp()` split, request-id + error envelope, Vitest + CI gates); WS2 (config-sourced RBAC, policy middleware, isolated + audited `/api/admin/questions`, append-only audit log, self-scoped `/api/v1/me/*`); WS3 (immutable wallet ledger + idempotency, server-authoritative `POST /api/v1/progression/completions` with stable `eventId`, preference/progression write split, one-time bounded migration, atomic JSON adapter); WS4 part 1 (practice-track + mastery + global-stats authority, `/progression/answers`, `/shop/purchases`, `/me/learning-state`; React client cutover); **WS4 part 2 (all rollout break-glass flags + legacy `x-user-id` / `PUT /profile` / `telegramAuth.ts` / dead `storage.ts` removed; in-memory rate limiting §13; structured logs + metrics + health/live+ready §16; demo routes isolated to non-production; DoD sign-off §23)**. `npm run check` green, 146 tests. | [Phase 1](./phases/PHASE_1_PRODUCTION_SAFETY_AND_ENGINEERING_FOUNDATION.md) |
| 2 | Core Architecture & Authoritative Data Platform | **core complete — DoD §26.1: 14/17 fully met** (2026-09-09). 5 stacked workstreams; stack = Zod + Drizzle + pg-boss (ADR-012/013/014 accepted, ADR-015 object storage). **WS1–WS4 merged** (PRs #8 `b4d0a34`, #9 `009c5a2`, #10 `1ca59bd`, #11 `f25eca5`): `contracts/` runtime schemas + `validateBody` + §7.5 error envelope + port-free `createHttpServer`; Drizzle persistence + migration framework + identity/RBAC + persisted `RoleResolver` + shared rate-limit store; canonical `question_revisions` + `CANONICAL_CONTENT_REPOSITORY` cutover + realtime gateway v2 (`REALTIME_GATEWAY_V2`); frontend typed API client + query-key factory + provider decomposition + `PlayerContext` retired. **WS5** (`phase-2/ws5-jobs-storage-deploy`): background `JobQueue` + worker + retention sweeps (ADR-014; durable pg-boss adapter deferred, in-memory default); `ObjectStore` filesystem/S3 adapters + `content.snapshot` job (ADR-015); `docs/DEPLOYMENT.md` + `docs/OBSERVABILITY.md` + `docs/ROLLOUT_PHASE_2.md`; HTTP/DB metrics + frontend error reporting; typed `user_preferences` cutover + `LEGACY_STORE_READONLY` + backfill script. `npm run check` green, 342 tests. **Remaining (rollout follow-up, §27 step 9):** progression/entitlement decomposition out of the `player_profiles`/`player_stats` blobs into typed transactional tables, then retiring `STORAGE_PROVIDER=json` for them — DoD #6/#7/#9 partial until done. | [Phase 2](./phases/PHASE_2_CORE_ARCHITECTURE_AND_DATA_PLATFORM.md) |
| 3 | Learning Product, MVP, Rebrand & Motion | partial legacy UI exists; canonical completion blocked by Phase 1–2 — має довести `lesson → practice → review → mastery → progress` і інтегрувати «Мільйонер» через спільний Question Runtime | [Phase 3](./phases/PHASE_3_LEARNING_PRODUCT_REBRAND_AND_MOTION.md) |
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
