# Bible Games — AI System Rebuild Roadmap
## Детальна модернізація AI-системи відповідно до Master Prompt

> Репозиторій: `DenisPoselyanov/biblegames_bot`
> Основна мова продукту й AI-контенту: українська
> Цільовий шлях у репозиторії: `docs/product-rebuild/AI_CONTENT_PIPELINE.md`
> Головне джерело правди: `docs/product-rebuild/MASTER_ROADMAP.md`
> Основна фаза: **Phase 10 — AI core v2 і reviewed content pipeline**
> Залежна фаза: **Phase 11 — Protected Content Studio**

---

# 1. Мета

AI-система Bible Games має перейти від набору окремих генераторів і ремонтних скриптів до керованої платформи підготовки навчального контенту.

Цільовий життєвий цикл:

```text
Навчальна мета
→ навчальний план
→ модуль
→ урок
→ біблійний контекст
→ пояснення
→ практика
→ питання
→ картки повторення
→ автоматичні перевірки
→ редакторський перегляд
→ публікація
→ аналітика якості
```

Основний принцип:

> **AI генерує чернетки та допомагає редактору, але не є джерелом біблійної істини й не має права самостійно публікувати контент.**

---

# 2. Непорушні правила

1. AI не пише безпосередньо в published production content.
2. Усі результати спочатку потрапляють у staging.
3. Structured output завжди проходить schema validation.
4. Питання проходять deterministic validation.
5. Біблійні цитати та посилання проходять Scripture verification.
6. Теологічно чутливий контент потребує human reviewer.
7. `autoApprove` за замовчуванням завжди `false`.
8. Невалідний `correctIndex` не замінюється на `0`.
9. Provider error не перетворюється на порожній успішний результат.
10. Repair, approve і publish — різні операції.
11. Published version має immutable audit trail.
12. User-facing learning flow повинен працювати без AI.
13. AI-помічник не подається як духовний авторитет.
14. Open-ended AI chat не є першим user-facing AI-функціоналом.
15. Жоден AI job не може мати нескінченний retry або необмежений бюджет.

---

# 3. Два незалежні напрями AI

```text
A. AI Content Production
B. AI In-App Learning Assistance
```

## 3.1. AI Content Production

Внутрішній pipeline для content team:

- генерація learning plans;
- модулі та lesson outlines;
- typed lesson blocks;
- питання й набори питань;
- короткі та поглиблені пояснення;
- review cards;
- класифікація тем і складності;
- перевірка дублікатів;
- Scripture verification;
- quality audit;
- staging;
- editor/reviewer workflow;
- контрольована публікація.

## 3.2. AI In-App Learning Assistance

Додається лише після стабілізації AI Content Production.

Перші функції:

1. «Поясни, чому моя відповідь неправильна».
2. «Покажи контекст уривка».
3. «Поясни термін простіше».
4. «Покажи пов'язані опубліковані матеріали».
5. «Створи коротке повторення».

Обмеження:

- retrieval лише з published content;
- trusted Scripture source;
- references у відповіді;
- явна позначка «AI-пояснення»;
- feedback/report;
- rate limit;
- cost limit;
- caching;
- privacy;
- deterministic fallback;
- без автоматичних доктринальних вироків.

---

# 4. Обов'язковий аудит поточної системи

Перед будь-яким refactor Codex повинен створити read-only аудит.

Перевірити всі наявні AI-команди, зокрема:

```text
fix-questions-ai
generate-topics
generate-topics-ai
sort-topics-ai
questions:stats
questions:dedupe-db
analyze-questions
analyze-quality
analyze-explanations
fix-explanations-ai
analyze-topics
analyze-pools
test-classification
scripture:audit
ai-topic-edit
generate-ai
topic-conveyor
topic-preview-index
ai-launcher
balance-questions
fill-practice
fill-practice-nodes
prune-untagged
```

Для кожної команди зафіксувати:

- npm script;
- entry file;
- призначення;
- provider і model;
- input і output;
- write path;
- чи змінює active DB;
- чи має dry-run;
- validation;
- retry;
- resume;
- tests;
- дублювання;
- ризики;
- replacement;
- deprecation target.

Створити:

```text
docs/product-rebuild/ai/
├── CURRENT_AI_AUDIT.md
├── LEGACY_COMMAND_MATRIX.md
├── PROVIDER_MATRIX.md
├── DATA_FLOW_MAP.md
└── AI_RISK_REGISTER.md
```

Обов'язково перевірити:

- broken legacy topic generator;
- undefined imports/functions;
- provider/model mismatch;
- універсальну `AI_MODEL`;
- Ollama env, зчитане до `.env` initialization;
- duplicated normalizers;
- duplicated JSON parsing;
- fragmented retry logic;
- swallowed errors;
- invalid answer fallback;
- auto-approval;
- прямий production write;
- unsafe pool fallback;
- non-atomic writes;
- hardcoded launcher provider/model lists;
- відсутність `MockProvider`;
- відсутність staging/versioning/review trail;
- генерацію питання без `learningObjectiveId`.

---

# 5. Цільова структура

```text
scripts/ai/
├── core/
│   ├── config.ts
│   ├── errors.ts
│   ├── types.ts
│   ├── logger.ts
│   ├── job-runner.ts
│   ├── job-context.ts
│   ├── job-store.ts
│   ├── retry-policy.ts
│   ├── rate-budget.ts
│   ├── cost-budget.ts
│   ├── checkpoints.ts
│   ├── cancellation.ts
│   ├── structured-output.ts
│   ├── atomic-write.ts
│   └── hashing.ts
├── providers/
│   ├── provider.ts
│   ├── registry.ts
│   ├── mock.ts
│   ├── ollama.ts
│   ├── gemini.ts
│   └── omniroute.ts
├── schemas/
│   ├── common.schema.ts
│   ├── learning-objective.schema.ts
│   ├── plan.schema.ts
│   ├── module.schema.ts
│   ├── lesson.schema.ts
│   ├── lesson-block.schema.ts
│   ├── question.schema.ts
│   ├── question-set.schema.ts
│   ├── explanation.schema.ts
│   ├── review-card.schema.ts
│   ├── classification.schema.ts
│   ├── scripture-check.schema.ts
│   ├── job.schema.ts
│   └── publication.schema.ts
├── prompts/
│   ├── shared/
│   │   ├── language.ts
│   │   ├── theological-policy.ts
│   │   ├── scripture-policy.ts
│   │   ├── quality-policy.ts
│   │   └── output-policy.ts
│   ├── plans.ts
│   ├── lessons.ts
│   ├── questions.ts
│   ├── explanations.ts
│   ├── review-cards.ts
│   ├── classification.ts
│   ├── topics.ts
│   ├── scripture.ts
│   └── audits.ts
├── validators/
│   ├── schema-validator.ts
│   ├── semantic-validator.ts
│   ├── question-validator.ts
│   ├── lesson-validator.ts
│   ├── duplicate-validator.ts
│   ├── scripture-validator.ts
│   ├── theological-validator.ts
│   ├── language-validator.ts
│   └── publication-validator.ts
├── tasks/
│   ├── plans-generate.ts
│   ├── plans-audit.ts
│   ├── lessons-generate.ts
│   ├── lessons-audit.ts
│   ├── questions-generate.ts
│   ├── questions-fill.ts
│   ├── questions-classify.ts
│   ├── questions-audit.ts
│   ├── questions-repair.ts
│   ├── explanations-generate.ts
│   ├── review-cards-generate.ts
│   ├── topics-organize.ts
│   ├── scripture-verify.ts
│   ├── staging-inspect.ts
│   └── publish.ts
├── repositories/
│   ├── content-repository.ts
│   ├── staging-repository.ts
│   ├── job-repository.ts
│   ├── audit-repository.ts
│   └── scripture-repository.ts
├── registry.ts
└── cli.ts
```

Пізніше reusable частини можна перенести у:

```text
packages/ai-core/
packages/content-schema/
```

Не виконувати workspace rewrite одночасно з першим AI refactor.

---

# 6. Provider abstraction

```ts
export interface AiProvider {
  readonly id: AiProviderId;

  readonly capabilities: {
    text: boolean;
    jsonObject: boolean;
    jsonArray: boolean;
    schema: boolean;
    streaming: boolean;
  };

  generateText(
    request: TextGenerationRequest,
    context: AiRequestContext,
  ): Promise<AiResponse<string>>;

  generateObject<T>(
    request: ObjectGenerationRequest<T>,
    context: AiRequestContext,
  ): Promise<AiResponse<T>>;

  generateArray<T>(
    request: ArrayGenerationRequest<T>,
    context: AiRequestContext,
  ): Promise<AiResponse<T[]>>;

  healthCheck?(): Promise<ProviderHealth>;
}
```

`AiResponse<T>` має містити:

- provider;
- model;
- requestId;
- timestamps;
- durationMs;
- attempts;
- token usage;
- estimated cost;
- finish reason;
- parsed result;
- warnings;
- raw response reference.

Provider adapter не повинен:

- знати про `Question` або `Lesson`;
- писати файли;
- approve/publish;
- містити task-specific prompts;
- приховувати errors;
- непомітно змінювати model.

## 6.1. MockProvider

Обов'язково підтримати:

- deterministic fixtures;
- delay;
- transient error;
- permanent error;
- malformed JSON;
- schema-invalid result;
- rate limit;
- cancellation;
- token/cost fixture.

Усі orchestration tests мають працювати без реального API.

---

# 7. Конфігурація

Використовувати:

```text
AI_DEFAULT_PROVIDER
AI_OLLAMA_MODEL
AI_GEMINI_MODEL
AI_OMNIROUTE_MODEL
AI_OLLAMA_HOST
AI_OLLAMA_PORT
AI_MAX_ATTEMPTS
AI_MAX_TOTAL_WAIT_MS
AI_MAX_REQUESTS_PER_JOB
AI_MAX_TOKENS_PER_JOB
AI_MAX_COST_PER_JOB_USD
AI_JOB_STORAGE
AI_STAGING_STORAGE
AI_RAW_RESPONSE_RETENTION
AI_LOG_LEVEL
GEMINI_API_KEY
OMNIROUTE_API_KEY
```

Не використовувати одну універсальну `AI_MODEL`.

Model resolution:

```text
CLI explicit model
→ task override
→ provider-specific env
→ provider default
```

`.env` завантажується до config resolution. Ollama host/port читаються runtime, а не фіксуються import-time constants.

Startup validation:

- provider існує;
- required secret присутній;
- model валідний;
- numeric limits валідні;
- paths доступні;
- flags не конфліктують;
- effective config логуються без secrets.

---

# 8. Structured output

Режими:

```text
text
json_object
json_array
schema
```

Top-level array не запитувати як `json_object`.

Pipeline:

```text
raw response
→ provider extraction
→ normalized text
→ JSON extraction
→ parse
→ schema validation
→ semantic validation
→ domain validation
→ staging
```

Заборонені fallback:

- `{}` після parse error;
- `[]` після provider failure;
- `correctIndex = 0`;
- silent field dropping;
- incomplete result як success;
- invalid content як published.

Дозволений один bounded repair pass:

```text
parse failed
→ structured repair request
→ parse again
→ validate
```

Repair не може змінювати Scripture/correct answer без review і не може publish.

---

# 9. AI jobs

Job states:

```text
queued
running
waiting_retry
paused
cancel_requested
cancelled
failed
completed
completed_with_warnings
```

Job має містити:

- ID;
- task type;
- status;
- provider/model;
- actor;
- input/output refs;
- progress;
- request/token/cost budgets;
- usage;
- checkpoint;
- errors;
- warnings;
- timestamps.

Checkpoints:

- після кожного item або safe batch;
- processed/failed IDs;
- input/content hashes;
- resume без дублювання;
- explicit restart при зміні input hash.

Cancellation:

- cooperative;
- `AbortSignal`;
- перевірка між requests;
- partial artifacts позначаються incomplete;
- жодного partial publish.

---

# 10. Retry і budgets

Retryable:

- timeout;
- connection reset;
- 429;
- provider 5xx;
- temporary unavailable;
- один repair attempt для malformed output.

Non-retryable:

- invalid config;
- missing key;
- unsupported capability;
- schema failure після repair;
- semantic/policy violation;
- unauthorized;
- cancelled;
- budget exceeded.

Retry policy:

- max attempts;
- exponential backoff;
- jitter;
- max total wait;
- `Retry-After`;
- structured logs;
- budget accounting.

Кожен job має:

- max requests;
- max tokens;
- max estimated cost;
- max total wait;
- optional deadline/max items.

При перевищенні budget job зупиняється, а checkpoint зберігається.

---

# 11. Learning-first content model

AI працює з ієрархією:

```text
LearningPlan
→ Module
→ Lesson
→ LearningObjective
→ LessonBlock
→ QuestionSet
→ Question
→ ReviewCard
```

AI не генерує питання без:

- `learningObjectiveId`;
- objective description;
- target audience;
- difficulty;
- Scripture scope;
- topic IDs.

Питання повинно містити:

```ts
interface GeneratedQuestionDraft {
  id: string;
  learningObjectiveId: string;
  topicIds: string[];
  scriptureReferences: ScriptureReference[];
  difficulty: Difficulty;
  text: string;
  options: string[];
  correctIndex: number;
  explanationShort: string;
  explanationDeep?: string;
  misconceptionTarget?: string;
  theologicalSensitivity: 'neutral' | 'sensitive' | 'confessional';
  generationMetadata: GenerationMetadata;
  publicationState: 'draft';
}
```

Lesson generation використовує typed `LessonBlock[]`, а не довільний HTML blob.

---

# 12. Validation pipeline

```text
1. Schema validation
2. Deterministic validation
3. Semantic validation
4. Duplicate validation
5. Scripture validation
6. Theological sensitivity classification
7. AI-assisted review where needed
8. Human review
```

## 12.1. Question checks

- 2–6 options;
- correctIndex у межах;
- correct answer не порожня;
- options унікальні після normalization;
- question/explanation не порожні;
- Scripture reference syntactically valid;
- objective/topic існують;
- difficulty valid;
- no exact/normalized duplicate;
- no obvious answer leakage;
- correct answer узгоджена з explanation;
- generator завжди створює `draft`.

## 12.2. Lesson checks

- plan/module/objective існують;
- required blocks існують;
- Scripture block має reference;
- no empty/unsupported block;
- no unsafe HTML;
- duration sensible;
- language Ukrainian;
- summary відповідає objectives.

## 12.3. Duplicate detection

- exact hash;
- normalized text hash;
- option-set similarity;
- semantic similarity;
- objective overlap;
- Scripture overlap.

Semantic duplicate не видаляється автоматично — лише warning/review.

---

# 13. Scripture verification

AI не є джерелом біблійного тексту.

Перевіряти:

- book;
- chapter;
- verse range;
- canonical reference;
- selected translation;
- exact quote;
- paraphrase status;
- explanation-reference alignment.

Модель:

```ts
interface ScriptureReference {
  canon: 'protestant-66';
  bookId: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
}

interface ScriptureTextSnapshot {
  reference: ScriptureReference;
  translationId: string;
  text: string;
  source: string;
  retrievedAt: string;
  hash: string;
}
```

Стани:

```text
not_checked
valid
valid_with_warning
mismatch
unavailable
requires_human_review
```

Публікація заборонена при invalid reference, quote mismatch, unavailable exact quote або sensitive claim без reviewer.

---

# 14. Теологічна політика

Створити:

```text
docs/product-rebuild/ai/THEOLOGICAL_CONTENT_POLICY.md
```

Категорії:

```text
neutral
sensitive
confessional
disputed
```

Чутливі напрями можуть включати:

- хрещення;
- дари Духа;
- спасіння/відступлення;
- передвизначення;
- роль жінки;
- есхатологію;
- церковне управління;
- причастя;
- освячення.

Sensitive content:

- має label;
- має references;
- потребує reviewer;
- не подається як єдина універсальна інтерпретація без policy.

Prompts повинні вимагати:

- не вигадувати citations;
- розрізняти quote та interpretation;
- використовувати українську;
- не використовувати маніпулятивний spiritual language;
- не називати AI духовним наставником.

---

# 15. Publication workflow

States:

```text
draft
→ schema_checked
→ deterministic_checked
→ scripture_checked
→ ai_reviewed
→ human_approved
→ published
```

Додаткові:

```text
quarantined
rejected
superseded
archived
```

Client не може довільно встановлювати state.

Publish transaction:

1. permission check;
2. current state check;
3. validation results check;
4. reviewer check;
5. immutable content version;
6. publication event;
7. atomic active-version switch;
8. cache invalidation;
9. rollback target;
10. audit record.

Rollback:

- не видаляє version;
- позначає superseded;
- активує попередню approved version;
- записує actor/reason/time;
- invalidates cache.

---

# 16. Staging

Staging artifact зберігає:

- content;
- validation results;
- warnings;
- generation metadata;
- input hash;
- prompt version;
- provider/model;
- raw response ref;
- editor changes;
- reviewer comments;
- publication state.

Не використовувати як source of truth випадкові JSON-файли без manifest.

File transition:

```text
write temp
→ validate saved artifact
→ atomic rename
```

DB transition:

- transaction;
- optimistic version;
- constraints;
- guarded state transition.

---

# 17. Єдиний CLI

```text
npm run ai -- plans generate
npm run ai -- plans audit
npm run ai -- lessons generate
npm run ai -- lessons audit
npm run ai -- questions generate
npm run ai -- questions fill --policy practice-ready
npm run ai -- questions fill --policy equalize
npm run ai -- questions classify
npm run ai -- questions audit
npm run ai -- questions repair
npm run ai -- explanations generate
npm run ai -- review-cards generate
npm run ai -- topics organize
npm run ai -- scripture verify
npm run ai -- staging inspect
npm run ai -- publish
npm run ai -- jobs list
npm run ai -- jobs show <id>
npm run ai -- jobs resume <id>
npm run ai -- jobs cancel <id>
npm run ai -- registry --json
npm run ai -- providers health
```

Common flags:

```text
--provider
--model
--dry-run
--limit
--concurrency
--max-attempts
--max-requests
--max-tokens
--max-cost-usd
--resume
--job-id
--output
--format
--verbose
```

`--dry-run` не змінює staging/production, показує task plan, provider/model, estimated requests та affected IDs.

Registry повинен бути machine-readable, щоб launcher не мав hardcoded списків.

---

# 18. Legacy migration

Етапи:

```text
inventory
→ classify
→ wrap with new core
→ deprecation warning
→ npm alias redirect
→ compare outputs
→ migrate workflows
→ remove after acceptance
```

Категорії:

```text
Keep temporarily
Wrap
Merge
Replace
Remove as broken
Remove as unsafe
```

Deprecated alias:

- показує warning;
- викликає new CLI;
- має removal target;
- не обходить staging/validation.

Для ключових tasks створити golden dataset і порівняти:

- schema pass;
- quality;
- duplicate rate;
- Scripture mismatches;
- runtime;
- cost.

---

# 19. Content Studio integration

Основні екрани:

- AI Dashboard;
- Jobs;
- Generate Learning Plan;
- Generate Lesson;
- Generate Questions;
- Scripture Verification;
- Question Review;
- Lesson Review;
- Quarantine;
- Publication Board;
- Content History;
- Provider/Budget Settings;
- Audit Log.

Reviewer бачить:

- generated content;
- source objective;
- Scripture refs і exact text;
- correct option;
- explanation;
- duplicate warnings;
- theological sensitivity;
- validation results;
- AI metadata;
- edit history.

Дії:

```text
Approve
Edit and approve
Quarantine
Reject
Request regeneration
Compare version
```

Publication board може показувати колонки states, але drag-and-drop не обходить server transition rules.

---

# 20. Backend API і RBAC

Приклад API:

```text
POST   /admin/ai/jobs
GET    /admin/ai/jobs
GET    /admin/ai/jobs/:jobId
POST   /admin/ai/jobs/:jobId/cancel
POST   /admin/ai/jobs/:jobId/resume
GET    /admin/content/staging
GET    /admin/content/staging/:artifactId
PATCH  /admin/content/staging/:artifactId
POST   /admin/content/:artifactId/validate
POST   /admin/content/:artifactId/quarantine
POST   /admin/content/:artifactId/reject
POST   /admin/content/:artifactId/approve
POST   /admin/content/:artifactId/publish
GET    /admin/content/:artifactId/history
POST   /admin/content/:artifactId/rollback
GET    /admin/ai/providers
GET    /admin/ai/providers/health
```

Permissions:

```text
ai_job_create
ai_job_cancel
content_edit
content_review
content_approve
content_publish
content_rollback
ai_settings_manage
audit_read
```

Roles:

```text
content_editor
content_reviewer
admin
super_admin
```

Generation permission не означає publish permission.

---

# 21. Security і privacy

Secrets:

- тільки server/CLI env;
- не frontend;
- не logs;
- не job metadata;
- startup validation;
- rotation support.

Prompt injection:

- external text = untrusted data;
- source content відокремлений від system instruction;
- source не змінює policy;
- markup sanitized;
- allowlisted actions;
- AI не має direct DB tool.

Не передавати provider:

- Telegram init data;
- auth tokens;
- payment data;
- email/phone;
- повний profile;
- private group data без потреби.

Мінімальний personalization context:

```text
learning level
selected topic
recent answer state
published content refs
```

Audit:

- actor;
- action;
- target;
- before/after refs;
- provider/model;
- job ID;
- timestamp;
- reason;
- correlation ID.

---

# 22. Observability

Structured log fields:

```text
timestamp
level
jobId
task
provider
model
requestId
artifactId
attempt
durationMs
status
errorCode
tokenUsage
estimatedCost
correlationId
```

Metrics:

- queued/completed/failed/cancelled jobs;
- retries;
- provider latency/error rate;
- parse/schema failures;
- Scripture mismatch;
- duplicates;
- human rejection;
- publish conversion;
- edit distance;
- tokens/cost;
- time to review/publish.

Alerts:

- provider failure spike;
- schema failure spike;
- Scripture mismatch spike;
- budget anomaly;
- publish without reviewer;
- stuck queue;
- secret/config failure.

---

# 23. Testing

## 23.1. Unit

- config/model resolution;
- runtime env;
- capabilities;
- object/array parsing;
- repair pass;
- normalized errors;
- retry/max wait;
- budgets;
- cancellation;
- checkpoints;
- hashes;
- atomic writes;
- question/lesson schemas;
- invalid correct index;
- duplicate detection;
- Scripture parser;
- publication transitions;
- permissions.

## 23.2. Provider contract

Shared suite для Mock/Ollama/Gemini/OmniRoute. Real-provider tests opt-in.

## 23.3. Integration

- task success;
- transient failure then success;
- permanent failure;
- malformed JSON;
- invalid schema;
- cancellation/resume;
- budget exceeded;
- partial batch;
- duplicates;
- Scripture mismatch;
- no auto publish.

## 23.4. Publication

```text
draft
→ validation
→ human approval
→ publish
→ content delivery
→ rollback
```

Forbidden transitions мають бути протестовані.

## 23.5. Security

- ordinary user denied;
- editor cannot publish без permission;
- reviewer cannot manage secrets;
- client cannot force state;
- prompt-injection fixtures;
- secret redaction;
- rate limiting;
- audit creation.

---

# 24. User-facing AI

Feature flag:

```text
in_app_ai_assistance
```

RAG corpus:

- published lessons;
- approved explanations;
- trusted Scripture snapshots;
- approved glossary;
- approved topic relations.

Не використовувати:

- drafts;
- quarantined/rejected content;
- editor notes;
- raw AI output;
- unverified web content.

Response contract:

```ts
interface LearningAssistanceResponse {
  answer: string;
  citations: Array<{
    type: 'scripture' | 'lesson' | 'glossary';
    id: string;
    label: string;
  }>;
  generatedByAi: true;
  warnings: string[];
  feedbackToken: string;
}
```

UX states:

- AI label;
- references;
- feedback/report;
- loading;
- retry;
- fallback approved explanation;
- unavailable;
- limit reached.

---

# 25. Детальні підетапи Phase 10

## AI Phase 10.0 — Audit only

Deliverables: audit docs, legacy matrix, provider matrix, risk register. Без behavior changes.

Commit:

```text
phase-10a: audit legacy AI workflows and risks
```

## AI Phase 10.1 — Schemas and validation

Shared schemas, legacy adapters, publication states, validators, tests.

Commit:

```text
phase-10b: introduce AI content schemas and validators
```

## AI Phase 10.2 — Provider core

Provider contract, registry, config, model resolution, runtime env, errors, MockProvider.

Commit:

```text
phase-10c: unify AI providers and model configuration
```

## AI Phase 10.3 — Job runner

Jobs, retry, budgets, cancellation, checkpoints, resume, logs.

Commit:

```text
phase-10d: add resilient AI jobs checkpoints and budgets
```

## AI Phase 10.4 — Staging

Staging repository, manifests, atomic writes, hashes, no direct production writes.

Commit:

```text
phase-10e: route AI outputs through versioned staging
```

## AI Phase 10.5 — Unified tasks and CLI

Task registry, new CLI, dry run, registry JSON, all target commands.

Commit:

```text
phase-10f: consolidate AI workflows behind one CLI
```

## AI Phase 10.6 — Legacy migration

Aliases, warnings, comparisons, removal dates, safe disabling of broken scripts.

Commit:

```text
phase-10g: migrate legacy AI commands to the new pipeline
```

## AI Phase 10.7 — Scripture and theological checks

Trusted source, reference parser, quote verification, sensitivity, reviewer gates.

Commit:

```text
phase-10h: add Scripture verification and theological review gates
```

## AI Phase 10.8 — Publication workflow

State machine, permissions, approve/publish, versions, rollback, audit.

Commit:

```text
phase-10i: implement reviewed content publication and rollback
```

## AI Phase 10.9 — Content Studio API

Jobs/staging/review/provider APIs, RBAC, API schema documentation.

Commit:

```text
phase-10j: expose protected AI and content review APIs
```

## AI Phase 10.10 — Final hardening

Tests, performance, security, metrics, docs, failure drills, roadmap, Phase 11 readiness.

Final commit:

```text
phase-10: rebuild AI content pipeline for reviewed learning content
```

---

# 26. Feature flags

```text
ai_core_v2
ai_staging_v2
ai_cli_v2
ai_scripture_verification
ai_publication_workflow
ai_provider_gemini
ai_provider_ollama
ai_provider_omniroute
content_studio_v2
in_app_ai_assistance
```

Flags централізовані, документовані, мають rollout/removal target і не обходять security.

---

# 27. Migration і rollback

Migration:

- legacy commands через aliases;
- adapter старого question format;
- published content не переписується автоматично;
- новий staging для нових artifacts;
- history import окремою command;
- old IDs зберігаються;
- hashes/version metadata додаються.

Rollback AI core:

- feature flag;
- compatibility read path;
- no destructive conversion;
- isolated staging;
- provider-independent artifacts.

Rollback не може повертати unsafe direct publish.

---

# 28. Definition of Done Phase 10

- [ ] AI audit завершений;
- [ ] legacy matrix завершена;
- [ ] provider contract;
- [ ] MockProvider;
- [ ] provider contract tests;
- [ ] provider-specific config;
- [ ] `AI_MODEL` усунута/deprecated;
- [ ] runtime env виправлений;
- [ ] text/object/array розділені;
- [ ] schemas;
- [ ] invalid correct index rejected;
- [ ] bounded retry;
- [ ] cancellation;
- [ ] checkpoints/resume;
- [ ] budgets;
- [ ] staging only;
- [ ] atomic persistence;
- [ ] Scripture verification;
- [ ] theological sensitivity;
- [ ] human review;
- [ ] publication state machine;
- [ ] rollback versions;
- [ ] audit trail;
- [ ] unified CLI;
- [ ] deprecated aliases;
- [ ] no auto approve;
- [ ] admin API protected;
- [ ] secret redaction;
- [ ] roadmap/ADR/migrations/rollback updated;
- [ ] final commit created.

---

# 29. Обов'язкові ADR

```text
ADR-AI-001 — Provider abstraction
ADR-AI-002 — Structured output and schema validation
ADR-AI-003 — AI job lifecycle
ADR-AI-004 — Staging storage
ADR-AI-005 — Publication state machine
ADR-AI-006 — Scripture verification source
ADR-AI-007 — Theological sensitivity policy
ADR-AI-008 — Legacy command migration
ADR-AI-009 — Raw response retention
ADR-AI-010 — In-app AI retrieval architecture
```

---

# 30. Формат звіту

```md
# AI Phase 10.X completed

## Goal
## Implemented
## Legacy behavior affected
## Stable contracts
## Files changed
## Schema changes
## Storage changes
## CLI changes
## Security impact
## Content-quality impact
## Tests
- command — result
## Migration
## Rollback
## Known limitations
## Roadmap updated
## Commit
- SHA
- message
## Next subphase readiness
```

Не переходити мовчки до наступного підетапу.

---

# 31. Початкова команда для Codex

Почни лише з **AI Phase 10.0 — Audit only**.

1. Перевір `git status`.
2. Прочитай `MASTER_ROADMAP.md`, `ARCHITECTURE.md`, `DATA_MODEL.md` і цей файл.
3. Знайди всі AI scripts, providers, env variables, write paths, validators і auto-approval paths.
4. Створи AI audit docs.
5. Онови `MASTER_ROADMAP.md`.
6. Створи ADR proposals.
7. Не змінюй production behavior.
8. Зроби commit.
9. Надай повний звіт.
10. Зупинись.

Commit:

```text
phase-10a: audit legacy AI workflows and risks
```

---

# 32. Фінальний принцип

> **Нова AI-система Bible Games повинна бути керованою, перевірюваною, відновлюваною, provider-independent і безпечною. Вона створює якісні чернетки навчального контенту, але остаточне рішення про біблійну точність і публікацію завжди належить validation та human review workflow.**
