# Historical Implementation Plan — Study 2.0

> **Статус:** архів попередньої ітерації.  
> **Не використовувати для планування нової роботи.**  
> **Актуальна специфікація:** [docs/BIBLE_GAMES_MASTER_SPECIFICATION.md](../BIBLE_GAMES_MASTER_SPECIFICATION.md)

Цей файл раніше описував етапи Study 2.0 і позначав багато старих Phase 1–13 як `Completed`. Ці статуси означали лише, що в попередній ітерації були створені певні типи, екрани, mock contracts, UI або локальні механіки. Вони **не означають**, що відповідний напрям готовий у сенсі нового production roadmap.

## Що було створено в межах старої ітерації

- learning-related domain types;
- streak/mastery/recommendation concepts;
- telemetry queue;
- repository-like frontend abstractions;
- JSON/PostgreSQL storage adapters;
- practice stages;
- rank і wisdom;
- recursive topics;
- question categorization;
- admin UI;
- design-system work;
- profile/home/play/shop redesign iterations;
- Kahoot і playlists;
- categories і multi-level drill-down;
- AI generation/sorting/analysis scripts.

## Чому старі `Completed` не переносяться

Після аудиту підтверджено, що частина старих результатів була:

- frontend-only;
- mock або in-memory;
- client-authoritative;
- без повного server typecheck;
- без integration/security tests;
- без production RBAC;
- без versioned migration;
- без content review lifecycle;
- без чесного global backend.

Тому нова специфікація перевіряє не наявність файлу чи екрана, а завершений product outcome із security, data integrity, tests, migration і rollback.

## Відповідність старого досвіду новим фазам

| Старий напрям | Де використовується далі |
|---|---|
| Foundation, storage, repositories | Phase 1–2 як baseline для виправлення |
| Study 2.0, practice, mastery | Phase 3 |
| AI scripts, question quality | Phase 4 |
| Social/challenges/communities | Phase 5 |
| Shop/profile cosmetics | Phase 6 |
| UI/design work | Phase 3 і Phase 7 |
| Kahoot | Phase 5 |

## Правило

Не оновлювати цей файл новими задачами, датами або статусами. Він зберігається тільки для історії прийнятих раніше ідей. Усі нові рішення йдуть у:

- `docs/BIBLE_GAMES_MASTER_SPECIFICATION.md`;
- `docs/DECISIONS.md`;
- pull request відповідної активної фази.