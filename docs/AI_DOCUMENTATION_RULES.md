# AI documentation authority rules

Перед будь-якою зміною Codex, Claude Code або інший агент повинен:

1. Прочитати `docs/README.md`.
2. Прочитати `docs/BIBLE_GAMES_MASTER_SPECIFICATION.md`.
3. Перевірити `docs/PHASE_STATUS.md`.
4. Повністю прочитати файл активної Phase в `docs/phases/`.
5. Перевірити relevant ADR/domain docs.
6. Звірити план з актуальним branch, git history, routes, schemas, migrations і tests.

Заборонено:

- використовувати `docs/archive/` як implementation instructions;
- трактувати старі completed Phase 0–7 як завершення нових однойменних Phase;
- створювати `MASTER_ROADMAP_NEW.md`, `FINAL_ROADMAP.md` або іншу паралельну систему;
- реалізовувати весь `FUTURE_UPGRADE_OPTIONS.md` як backlog;
- змінювати Phase status без evidence;
- приховувати конфлікт між документацією й кодом.

За конфлікту пріоритет: master specification → ADR → binding domain doc → active Phase plan → current code/tests → operations → future catalog → archive.

Окрему future option дозволено планувати лише після явного вибору власника за кодом і decision gate.