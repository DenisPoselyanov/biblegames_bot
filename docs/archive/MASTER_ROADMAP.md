# Historical Master Roadmap

> **Статус:** історичний документ, більше не є джерелом правди.  
> **Замінено:** 2026-08-02.  
> **Актуальна специфікація:** [BIBLE_GAMES_MASTER_SPECIFICATION.md](../BIBLE_GAMES_MASTER_SPECIFICATION.md)  
> **Готовий промт для Codex:** [AI_AGENT_MASTER_EXECUTION_PROMPT.md](../AI_AGENT_MASTER_EXECUTION_PROMPT.md)

Попередня версія цього файла описувала 13 фаз, окремі feature flags і детальний AI roadmap. Після аудиту було виявлено, що вона:

- конфліктувала зі старим `implementation_plan.md`, де інші фази вже були позначені `Completed`;
- ставила частину продуктового редизайну раніше за критичні auth, RBAC, server-authority та CI проблеми;
- містила надто дрібну AI-нумерацію `10.0–10.10`;
- дублювала ризики, рішення та цільову архітектуру в декількох документах;
- могла створити хибне враження, що документаційний progress дорівнює production progress.

## Новий порядок

Актуальний roadmap має великі цілісні фази:

1. Phase 0 — Canonical Documentation and Verified Baseline.
2. Phase 1 — Production Safety & Engineering Foundation.
3. Phase 2 — Core Architecture & Authoritative Data Platform.
4. Phase 3 — Learning-First Product Rebuild.
5. Phase 4 — Content Quality, Reviewed AI Pipeline & Protected Content Studio.
6. Phase 5 — Social, Groups, Challenges & Multiplayer.
7. Phase 6 — Economy, Shop, Entitlements & Monetization.
8. Phase 7 — Performance, Offline, Accessibility & Public Release.
9. Phase 8 — Expansion and Bonus Capabilities.

Усі цілі, залежності, acceptance criteria, migration rules, rollback і Definition of Done описані лише в головній специфікації.

## Правило сумісності

Посилання на цей файл можуть тимчасово залишатися в старих комітах, PR або нотатках. Для будь-якої нової роботи AI-агент зобов’язаний перейти до `BIBLE_GAMES_MASTER_SPECIFICATION.md` і не використовувати стару phase-нумерацію.