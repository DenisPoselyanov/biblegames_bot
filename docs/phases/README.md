# Bible Games — детальні плани імплементації Phase 0–8

> **Статус:** активний implementation index  
> **Канонічний roadmap:** [`../BIBLE_GAMES_MASTER_SPECIFICATION.md`](../BIBLE_GAMES_MASTER_SPECIFICATION.md)  
> **Binding architecture refinement:** [`../OPEN_SOURCE_REFERENCE_ARCHITECTURE.md`](../OPEN_SOURCE_REFERENCE_ARCHITECTURE.md)  
> **Execution prompt:** [`../AI_AGENT_MASTER_EXECUTION_PROMPT.md`](../AI_AGENT_MASTER_EXECUTION_PROMPT.md)

Цей каталог деталізує реалізацію великих Phase 0–8. Він не створює нову нумерацію, паралельний roadmap або дрібні підфази. Кожен файл описує один великий продуктово-технічний блок і використовується Codex, Claude Code та іншими AI coding agents як execution plan після перевірки актуального коду.

`OPEN_SOURCE_REFERENCE_ARCHITECTURE.md` є обов’язковим companion-документом для всіх Phase. Він уточнює:

- які частини поточного React/TypeScript/Express/PostgreSQL стеку зберігаються;
- де додаються Zod, Drizzle, job queue, object storage, tests і conditional Redis;
- як розділити Question Bank, Question Runtime, Lesson Blocks, Review і Games;
- що входить до першого production MVP;
- які open-source проєкти використовуються як архітектурні референси;
- які патерни можна повторити та що заборонено копіювати.

## Плани

1. [`PHASE_0_CANONICAL_DOCUMENTATION_AND_BASELINE.md`](./PHASE_0_CANONICAL_DOCUMENTATION_AND_BASELINE.md) — канонічна документація, verified baseline, reference index і контроль джерел правди.
2. [`PHASE_1_PRODUCTION_SAFETY_AND_ENGINEERING_FOUNDATION.md`](./PHASE_1_PRODUCTION_SAFETY_AND_ENGINEERING_FOUNDATION.md) — trusted Telegram principal, RBAC, server authority, Zod contracts, standard errors, test foundation, CI, audit та release blockers.
3. [`PHASE_2_CORE_ARCHITECTURE_AND_DATA_PLATFORM.md`](./PHASE_2_CORE_ARCHITECTURE_AND_DATA_PLATFORM.md) — modular monolith, Drizzle/PostgreSQL migrations, repositories/services, canonical revisions, worker/jobs, object storage, search і deployment foundation.
4. [`PHASE_3_LEARNING_PRODUCT_REBRAND_AND_MOTION.md`](./PHASE_3_LEARNING_PRODUCT_REBRAND_AND_MOTION.md) — canonical MVP learning loop, Lesson Block Registry, Question Runtime, review, progress, `Світло`, motion і перша інтегрована гра «Мільйонер».
5. [`PHASE_4_CONTENT_AI_AND_CONTENT_STUDIO.md`](./PHASE_4_CONTENT_AI_AND_CONTENT_STUDIO.md) — content lifecycle, unified authoring, quality audit, reviewed AI pipeline, media proposals та protected Content Studio.
6. [`PHASE_5_SOCIAL_GROUPS_CHALLENGES_AND_MULTIPLAYER.md`](./PHASE_5_SOCIAL_GROUPS_CHALLENGES_AND_MULTIPLAYER.md) — private communities, group plans, async challenges, anti-abuse, а потім persistent Kahoot/realtime lifecycle і load testing.
7. [`PHASE_6_ECONOMY_SHOP_ENTITLEMENTS_AND_MONETIZATION.md`](./PHASE_6_ECONOMY_SHOP_ENTITLEMENTS_AND_MONETIZATION.md) — immutable wallet ledger, catalog, themes, entitlements, purchases, Stars та окремо затверджені моделі монетизації.
8. [`PHASE_7_PERFORMANCE_OFFLINE_ACCESSIBILITY_AND_RELEASE.md`](./PHASE_7_PERFORMANCE_OFFLINE_ACCESSIBILITY_AND_RELEASE.md) — performance, offline capability matrix, CDN/media variants, accessibility, security hardening, observability, load tests і public release.
9. [`PHASE_8_EXPANSION_AND_BONUS_CAPABILITIES.md`](./PHASE_8_EXPANSION_AND_BONUS_CAPABILITIES.md) — advanced adaptive learning, FSRS optimization, bounded AI assistant, Church/Classroom, internationalization та інші окремо схвалені напрями.

## Open-source reference map

| Phase | Основні референси | Що вивчати |
|---:|---|---|
| 1 | Oppia, Moodle, ClassQuiz | validation discipline, attempt safety, security/load test mindset |
| 2 | Oppia, Moodle, H5P, AndBible | domain/storage separation, Bank vs Runtime, schemas/revisions, Scripture boundary |
| 3 | Oppia, H5P, Moodle, Anki/FSRS, Frappe Learning | objectives, lesson blocks, attempts, review state, simple course UX |
| 4 | Oppia, H5P, Frappe Learning, Kolibri, AndBible | editor workflow, content schemas, ingestion, media/licensing |
| 5 | ClassQuiz, Frappe Learning, Kolibri | rooms, host/player/display, batches, reconnect/recovery |
| 6 | власні ADR і Telegram contracts | зовнішні проєкти не визначають economy або pricing policy |
| 7 | Kolibri, AndBible, Anki, ClassQuiz | offline boundaries, content modules, logs/sync, load tests |
| 8 | вибирається для конкретної ініціативи | спочатку owner decision gate, потім reference spike |

Посилання, search terms, обмеження ліцензій та список «repeat/avoid» містяться в `OPEN_SOURCE_REFERENCE_ARCHITECTURE.md`.

## Canonical MVP gate

Перший production MVP не дорівнює завершенню всіх Phase 0–8. Він доводить цикл:

```text
published lesson
→ checkpoint
→ server-created practice session
→ answer feedback
→ mistake review
→ objective mastery
→ progress dashboard
```

До MVP також входить «Мільйонер» як перша game mode, що повторно використовує canonical Question Runtime і сім рівнів складності.

До першого MVP **не входять** live Kahoot, відкриті communities, user-facing AI chat, marketplace, Stars/Premium, full offline rewards і multi-instance Redis deployment.

## Правила використання

- Перед виконанням конкретної Phase прочитати її файл повністю.
- Обов’язково прочитати `../OPEN_SOURCE_REFERENCE_ARCHITECTURE.md` і вибрати лише релевантний reference project.
- Потім звірити вимоги з актуальним кодом, git history, tests і поточним branch.
- Файл Phase не може змінювати порядок, визначений master specification.
- Внутрішні workstreams, PR і коміти не є окремими Phase.
- Невідповідність між планом і фактичним кодом фіксується в execution brief; план не виконується сліпо.
- Security, data integrity, accessibility і rollback не можна відкласти заради швидшого UI.
- Документи з `docs/archive/` не використовуються як активні вимоги.
- Reference repository не є dependency. Не змінювати стек і не копіювати код без ADR/license review.
- Перед застосуванням зовнішнього патерну створити evidence table: задача → repo → search terms → pattern → native implementation → tests → license conclusion.
- Redis, Meilisearch, microservices або інший infrastructure component вводиться лише після виміряної потреби й explicit decision.

## Стандарт завершення

Phase не вважається завершеною через наявність екранів, файлів або успішного build. Потрібні:

- виконані acceptance criteria;
- зелені lint, typecheck, tests і build;
- server/security/data verification відповідно до scope;
- migration і rollback;
- feature flags та staged rollout для ризикових змін;
- оновлена документація;
- перелік відомих обмежень;
- evidence у PR, а не лише текст `completed`;
- доказ, що запозичений reference pattern реалізований нативно й не створив ліцензійний або stack conflict.
