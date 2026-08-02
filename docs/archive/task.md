# Historical Task Board — Study 2.0

> **Статус:** архів, не активний backlog.  
> **Актуальний порядок:** [docs/BIBLE_GAMES_MASTER_SPECIFICATION.md](../BIBLE_GAMES_MASTER_SPECIFICATION.md)  
> **Промт для виконання фази:** [docs/AI_AGENT_MASTER_EXECUTION_PROMPT.md](../AI_AGENT_MASTER_EXECUTION_PROMPT.md)

Стара task board була корисною під час попередньої ітерації, але її checkbox `Completed` не підтверджували production security, server authority, integration tests, migrations і release readiness.

## Історично виконані напрями

- domain types;
- learning engine concepts;
- telemetry;
- frontend repositories;
- API mock contracts;
- storage adapters;
- Supabase integration experiments;
- practice stages;
- topic hierarchy;
- UI redesigns;
- admin tools;
- AI scripts;
- Kahoot/social prototypes.

Ці результати не видаляються. Вони є baseline, який потрібно перевіряти, виправляти й мігрувати у відповідних нових фазах.

## Чому цей файл більше не активний

- нумерація конфліктувала з новим roadmap;
- `Completed` часто означало «створено happy path»;
- mock endpoint могли виглядати як готовий backend;
- security/data/content gates не були єдиними;
- нові задачі могли випадково додаватися до старої системи.

## Активна черга

1. Phase 1 — Production Safety & Engineering Foundation.
2. Phase 2 — Core Architecture & Authoritative Data Platform.
3. Phase 3 — Learning-First Product Rebuild.
4. Phase 4 — Content Quality, Reviewed AI Pipeline & Protected Content Studio.
5. Phase 5 — Social, Groups, Challenges & Multiplayer.
6. Phase 6 — Economy, Shop, Entitlements & Monetization.
7. Phase 7 — Performance, Offline, Accessibility & Public Release.
8. Phase 8 — Expansion and Bonus Capabilities.

## Правило task tracking

Не додавати нові checkbox у цей файл.

Для активної фази використовувати:

- acceptance criteria з головної специфікації;
- GitHub issues/PR checklist;
- branch і атомарні коміти;
- final phase evidence.

Коли вся фаза завершена, її статус оновлюється в головній специфікації, а не в окремій паралельній task board.