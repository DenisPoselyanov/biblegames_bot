# AI documentation authority rules

Перед будь-якою зміною Codex, Claude Code або інший агент повинен:

1. Прочитати `docs/README.md`.
2. Прочитати `docs/BIBLE_GAMES_MASTER_SPECIFICATION.md`.
3. Прочитати `docs/OPEN_SOURCE_REFERENCE_ARCHITECTURE.md`.
4. Перевірити `docs/PHASE_STATUS.md`.
5. Повністю прочитати файл активної Phase в `docs/phases/`.
6. Перевірити relevant ADR/domain docs.
7. Звірити план з актуальним branch, git history, routes, schemas, migrations і tests.

## Правило open-source референсів

Oppia, H5P, Moodle, ClassQuiz, Anki/FSRS, Frappe Learning, Kolibri, AndBible та інші зовнішні репозиторії є джерелами архітектурних патернів, а не готовими dependencies.

Перед використанням зовнішнього рішення агент зобов’язаний зафіксувати:

- конкретну задачу Bible Games;
- один основний reference repository;
- точні GitHub search terms або symbols;
- знайдений pattern/state machine/contract;
- що саме варто повторити;
- що не можна переносити;
- актуальність branch/останніх змін;
- license conclusion;
- native implementation path у Bible Games;
- required tests.

За замовчуванням реалізація пишеться нативно в поточному React/TypeScript/Express/PostgreSQL стеку. Зміна stack/framework/infrastructure потребує окремого ADR і виміряної необхідності.

Заборонено:

- використовувати `docs/archive/` як implementation instructions;
- трактувати старі completed Phase 0–7 як завершення нових однойменних Phase;
- створювати `MASTER_ROADMAP_NEW.md`, `FINAL_ROADMAP.md` або іншу паралельну систему;
- реалізовувати весь `FUTURE_UPGRADE_OPTIONS.md` як backlog;
- змінювати Phase status без evidence;
- приховувати конфлікт між документацією й кодом;
- писати «зробити як Moodle/Oppia/ClassQuiz» без точного патерну;
- копіювати великі файли, assets, translations або datasets із reference repo;
- додавати Next.js, NestJS, FastAPI, Frappe, Moodle/H5P runtime, Redis, Meilisearch, microservices або інший stack component лише тому, що він є у зовнішньому проєкті;
- копіювати GPL/AGPL/MPL або інший code без перевірки ліцензії та owner decision;
- вигадувати path, API або behavior стороннього репозиторію;
- вважати README доказом production correctness;
- змішувати кілька reference architectures без explicit domain ownership.

За конфлікту пріоритет: master specification → ADR → `OPEN_SOURCE_REFERENCE_ARCHITECTURE.md`/binding domain doc → active Phase plan → current code/tests → operations → future catalog → archive.

Окрему future option дозволено планувати лише після явного вибору власника за кодом і decision gate.
