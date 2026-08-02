# Historical AI System Rebuild Roadmap

> **Статус:** історичний детальний proposal.  
> **Не використовувати як окремий roadmap або phase system.**  
> **Актуальні вимоги:** [BIBLE_GAMES_MASTER_SPECIFICATION.md — Phase 4](../BIBLE_GAMES_MASTER_SPECIFICATION.md#phase-4--content-quality-reviewed-ai-pipeline--protected-content-studio)  
> **Execution prompt:** [AI_AGENT_MASTER_EXECUTION_PROMPT.md](../AI_AGENT_MASTER_EXECUTION_PROMPT.md)

Попередня версія цього документа мала приблизно 1530 рядків і ділила AI rebuild на `10.0–10.10`. Основні корисні вимоги перенесені до єдиної головної специфікації, але дрібна phase-нумерація скасована.

## Чому окремий roadmap скасовано

- він створював другу систему фаз;
- частково дублював master roadmap, risk register і ADR;
- міг початися до стабілізації auth, data architecture і learning objectives;
- пропонував дуже велику цільову структуру до підтвердження мінімально необхідних boundaries;
- ускладнював роботу соло-розробника та AI-агентів.

## Вимоги, які залишаються обов’язковими

### AI не є publisher

- AI створює draft;
- `autoApprove=false`;
- немає прямого write у published content;
- repair, approve і publish — різні operations;
- human review для theological/content-sensitive material;
- published revision immutable і auditable.

### Validation

- structured output schema validation;
- deterministic question validation;
- invalid `correctIndex` reject/quarantine, не `0`;
- duplicate checks;
- language checks;
- Scripture reference/quote checks;
- objective required;
- publication policy check.

### Provider abstraction

Підтримуються:

- Ollama;
- Gemini;
- OmniRoute;
- MockProvider.

Provider не повинен:

- писати content files;
- approve/publish;
- знати про UI;
- приховувати errors;
- непомітно змінювати model;
- мати task-specific domain side effects.

Provider response має зберігати мінімально потрібні metadata:

- provider;
- model;
- request/job ID;
- attempts;
- timestamps/duration;
- usage/cost, якщо доступно;
- finish reason;
- warnings;
- result/raw artifact reference.

### Configuration

Використовувати provider-specific config, наприклад:

```text
AI_DEFAULT_PROVIDER
AI_OLLAMA_MODEL
AI_GEMINI_MODEL
AI_OMNIROUTE_MODEL
AI_OLLAMA_HOST
AI_MAX_ATTEMPTS
AI_MAX_REQUESTS_PER_JOB
AI_MAX_TOKENS_PER_JOB
AI_MAX_COST_PER_JOB_USD
AI_STAGING_STORAGE
AI_JOB_STORAGE
GEMINI_API_KEY
OMNIROUTE_API_KEY
```

Не використовувати одну універсальну `AI_MODEL` для всіх provider.

### Job lifecycle

AI job повинен мати:

- status;
- retry policy;
- request/token/cost budget;
- cancellation;
- checkpoint/resume;
- input hash;
- attempts;
- logs;
- artifacts;
- validation result;
- requester;
- retention policy.

### Staging і publication

Цільовий стан:

```text
draft
→ generated
→ validation_failed | ready_for_review
→ changes_requested | approved
→ scheduled | published
→ superseded | archived
```

### Unified tooling

Цільовий entrypoint:

```text
npm run ai -- <task> [options]
```

Legacy commands можуть бути aliases лише тимчасово. Для кожної потрібні:

- purpose;
- input/output;
- provider/model;
- write path;
- dry-run status;
- validation;
- tests;
- replacement;
- removal target.

### Protected Content Studio

Потрібні:

- RBAC;
- jobs dashboard;
- staging queue;
- validation evidence;
- diff;
- review comments;
- Scripture preview;
- approve/publish permissions;
- rollback;
- audit trail.

Studio не повинен бути просто незахищеною вкладкою у звичайному user app.

### User-facing AI

Додається тільки після стабілізації reviewed content platform і retrieval з approved content.

Перші функції:

- пояснення помилки;
- контекст уривка;
- пояснення терміна простішою мовою;
- коротке повторення.

Обов’язкові:

- citations;
- AI label;
- feedback/report;
- privacy;
- rate/cost limits;
- caching;
- deterministic fallback;
- заборона автоматичних доктринальних вироків.

## Правильний спосіб реалізації

Не виконувати цей історичний файл по секціях. Використовувати:

1. Phase 1 — security/server authority;
2. Phase 2 — schemas/data boundaries;
3. Phase 3 — stable learning objectives і lessons;
4. Phase 4 — весь AI/content lifecycle як одна велика фаза.

Внутрішні PR і workstreams Phase 4 можуть бути атомарними, але не створюють нових `10.x` статусів.