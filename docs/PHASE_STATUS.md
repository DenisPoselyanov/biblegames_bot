# Bible Games — статус канонічних фаз

> Канонічний порядок визначає [BIBLE_GAMES_MASTER_SPECIFICATION.md](./BIBLE_GAMES_MASTER_SPECIFICATION.md). Детальні execution-плани знаходяться в [`phases/`](./phases/README.md). Стек, MVP, domain boundaries і open-source reference rules уточнює [OPEN_SOURCE_REFERENCE_ARCHITECTURE.md](./OPEN_SOURCE_REFERENCE_ARCHITECTURE.md).

| Phase | Назва | Статус | Детальний план |
|---:|---|---|---|
| 0 | Canonical Documentation and Verified Baseline | completed — canonical docs migrated; reference architecture and GitHub search guide indexed | [Phase 0](./phases/PHASE_0_CANONICAL_DOCUMENTATION_AND_BASELINE.md) |
| 1 | Production Safety & Engineering Foundation | **completed (2026-09-07)** — WS1 (env validation, hardened Telegram initData verifier, typed principal, fail-closed HTTP + Socket auth, `createApp()` split, request-id + error envelope, Vitest + CI gates); WS2 (config-sourced RBAC, policy middleware, isolated + audited `/api/admin/questions`, append-only audit log, self-scoped `/api/v1/me/*`); WS3 (immutable wallet ledger + idempotency, server-authoritative `POST /api/v1/progression/completions` with stable `eventId`, preference/progression write split, one-time bounded migration, atomic JSON adapter); WS4 part 1 (practice-track + mastery + global-stats authority, `/progression/answers`, `/shop/purchases`, `/me/learning-state`; React client cutover); **WS4 part 2 (all rollout break-glass flags + legacy `x-user-id` / `PUT /profile` / `telegramAuth.ts` / dead `storage.ts` removed; in-memory rate limiting §13; structured logs + metrics + health/live+ready §16; demo routes isolated to non-production; DoD sign-off §23)**. `npm run check` green, 146 tests. | [Phase 1](./phases/PHASE_1_PRODUCTION_SAFETY_AND_ENGINEERING_FOUNDATION.md) |
| 2 | Core Architecture & Authoritative Data Platform | **in progress (WS3)** — 5 stacked workstreams; stack = Zod + Drizzle + pg-boss (ADR-013 + ADR-012 accepted, ADR-014 proposed). **WS3 in progress** (`phase-2/ws3-content-realtime`): canonical `question_revisions` model + `@contracts` read contract + migration `0003`; validated legacy import (`legacy_unreviewed`, no first-option fallback, `npm run content:import-legacy`); read-path cutover behind `CANONICAL_CONTENT_REPOSITORY` (`off`/`compare`/`canonical`); realtime gateway v2 behind `REALTIME_GATEWAY_V2` (typed `RealtimeEvent` envelope + per-room sequence + clock + `resync_room`); bot boundary documented. **WS2 merged** (PR #9 → `main` `009c5a2`): `contracts/` runtime schemas, Drizzle persistence + migration framework, identity/RBAC tables + persisted `RoleResolver` + runtime `/api/v1/admin/roles`, shared Postgres rate-limit store. **WS1 merged** (PR #8 → `main` `b4d0a34`): `contracts/` runtime schemas, `validateBody` on the v1 command surface, §7.5 error envelope, `server/app/` composition split + port-free `createHttpServer`, `server/domains/` skeleton, architecture/parity tests; `npm run check` green, 167 tests. **WS2 in progress** (`phase-2/ws2-persistence`): Drizzle spike → ADR-012 accepted; persistence platform + migration framework (part 1), identity + RBAC tables + repositories (part 2), persisted RBAC wired into the request path — `RoleResolver` async seam, `roleService` + `/api/v1/admin/roles` runtime grant/revoke, closes the ADR-011 handoff (part 3, 205 tests); shared rate-limit store — `RateLimitStore` interface + atomic Postgres fixed-window adapter (`rate_limit_counters`, migration `0002`), in-memory default, fail-open, closes the Phase 1 §13 handoff (part 4, `npm run check` green, 215 tests). Next: PR WS2 → `main`. WS3–5: content repository + realtime gateway v2, frontend data architecture, jobs/storage/deploy/migration cutover + DoD | [Phase 2](./phases/PHASE_2_CORE_ARCHITECTURE_AND_DATA_PLATFORM.md) |
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
