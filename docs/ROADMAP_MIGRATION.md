# Migration from legacy product-rebuild roadmap

## Мета

До 2026-08-03 проєкт використовував `docs/product-rebuild/MASTER_ROADMAP.md` із Phase 0–13. Паралельно була створена повніша канонічна специфікація з Phase 0–8. Цей документ усуває двозначність і зберігає всю виконану роботу.

## Що сталося з кодом

Жодна реалізована функція не видалена й не відкочена. Коміти старих Phase 0–7 залишаються в `main` і формують фактичний baseline: domain barrels/migrations, design shell, learning-first navigation, Today, daily plan/streak, learning plans/lessons, practice/review та progress dashboard.

Позначка `completed` у старому roadmap означає завершення вузького старого scope, часто за feature flag. Вона не доводить виконання нових production gates: fail-closed auth, RBAC, server-authoritative economy/progress, audit, canonical data platform, content publication workflow, accessibility та release hardening.

## Відповідність нумерації

| Legacy roadmap | Стан | Канонічне місце |
|---|---|---|
| Old Phase 0 — baseline/audit | completed | evidence для canonical Phase 0 |
| Old Phase 1 — architecture boundaries/migrations | completed, partial | input для canonical Phase 2; **не закриває canonical Phase 1 security** |
| Old Phase 2 — premium design shell | completed, partial | baseline для canonical Phase 3 design migration |
| Old Phase 3 — learning-first navigation | completed behind flag | baseline для canonical Phase 3 |
| Old Phase 4 — Today/daily plan/streak | completed behind flags | baseline для canonical Phase 3; server authority ще перевіряється Phase 1–2 |
| Old Phase 5 — learning plans/lessons | completed behind flags | baseline для canonical Phase 3 та content input для Phase 4 |
| Old Phase 6 — practice/review | completed behind flags | baseline для canonical Phase 3; authoritative sessions належать Phase 1–2 |
| Old Phase 7 — progress/profile | completed behind flag | baseline для canonical Phase 3 |
| Old Phase 8 — shop/wallet | planned | canonical Phase 6 |
| Old Phase 9 — social/groups | planned | canonical Phase 5 |
| Old Phase 10–11 — AI pipeline/Content Studio | planned | canonical Phase 4 |
| Old Phase 12–13 — performance/release | planned | canonical Phase 7 |
| Old post-Phase AI assistance | candidate | canonical Phase 8 / `FUTURE_UPGRADE_OPTIONS.md` |

## Нові джерела правди

- Product/architecture/phase order: `BIBLE_GAMES_MASTER_SPECIFICATION.md`.
- Статус: `PHASE_STATUS.md`.
- Реалізація конкретної Phase: `phases/PHASE_*.md`.
- Рішення: `DECISIONS.md`.
- Design/motion/themes: відповідні domain-документи.
- Історична повна версія старого roadmap: `archive/legacy-product-rebuild/MASTER_ROADMAP.md`.

## Правило для AI-агентів

Не продовжувати з «Old Phase 8» лише тому, що old Phase 7 позначена completed. Наступною канонічною роботою є Phase 1 — Production Safety & Engineering Foundation. Перед реалізацією агент читає актуальний Phase-файл і звіряє його з current `main`.

## Rollback

Міграція змінює лише документацію та compatibility comments. Для відновлення старої структури достатньо revert цього merge-коміту; runtime-дані та код не мігруються.