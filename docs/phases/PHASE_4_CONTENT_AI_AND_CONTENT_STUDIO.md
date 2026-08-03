# Phase 4 — Content Quality, Reviewed AI Pipeline & Protected Content Studio

> **Priority:** P1/P2  
> **Depends on:** Phase 1 security/RBAC, Phase 2 content repository/job foundation, Phase 3 objective-based learning UI  
> **Canonical parent:** [`../BIBLE_GAMES_MASTER_SPECIFICATION.md`](../BIBLE_GAMES_MASTER_SPECIFICATION.md)

---

## 1. Product outcome

After Phase 4, Bible Games content is managed through an auditable editorial lifecycle instead of direct file mutation and loosely coordinated scripts.

The phase must guarantee that:

- AI cannot publish content;
- invalid questions are rejected or quarantined, never silently repaired into a “valid” answer;
- every published question, lesson and explanation has a revision and review history;
- Scripture references and quotations have evidence;
- content can be compared, approved, published, superseded and rolled back;
- legacy question banks are inventoried and progressively cleaned;
- Content Studio is protected by server-side roles and permissions;
- user-facing learning flows consume only approved published revisions according to policy.

---

## 2. Current baseline and conflicts

The repository currently contains many scripts for generation, sorting, analysis, repair, import and practice-pool assignment. Examples include commands for:

- AI question generation;
- topic generation and sorting;
- explanation analysis/repair;
- deduplication;
- classification testing;
- pool analysis;
- Scripture audit;
- Supabase import;
- Kahoot playlist generation/import;
- practice-stage assignment.

The current risks are not that these scripts exist, but that they can form parallel content truths and may write directly to data files without a unified lifecycle.

Additional conflicts:

- current question loaders may use JSON, embedded data and optional SQL paths;
- invalid answer index fallback can turn malformed content into answer zero;
- admin question routes can mutate content without a full review/publication model;
- AI provider configuration and model selection are spread across scripts;
- “generated”, “fixed”, “reviewed” and “published” are not consistently distinct;
- Ukrainian language quality and biblical accuracy require human judgment;
- user-facing lessons introduced in Phase 3 need stable published revisions.

---

## 3. Non-negotiable content principles

1. Published content is immutable; changes create a new revision.
2. AI output begins as a draft artifact, not approved content.
3. Generation, validation, repair, review, approval and publication are separate permissioned operations.
4. Invalid critical fields cause rejection/quarantine.
5. Scripture quotation and reference evidence are stored.
6. Human review is mandatory for theological/contextual approval.
7. User reports create review tasks, not direct content changes.
8. Rollback changes the active revision pointer and preserves history.
9. Scripts, Studio and imports use the same services/contracts.
10. Content quality metrics never override editorial responsibility.

---

## 4. Target content lifecycle

```text
imported | drafted | generated
→ validating
→ validation_failed | ready_for_review
→ in_review
→ changes_requested | approved
→ scheduled | published
→ superseded | archived
```

Additional quarantine states may exist for:

- invalid schema;
- unverifiable Scripture quotation;
- duplicate/near duplicate;
- ambiguous answer;
- theological sensitivity;
- unsafe language;
- unknown objective/topic mapping;
- unsupported translation/license state.

A state transition must have an actor, timestamp, reason and audit event.

---

## 5. Canonical content model

## 5.1 Content item and revision

Separate stable identity from revision:

```ts
interface ContentItem {
  id: string;
  type: 'question' | 'lesson' | 'explanation' | 'verse_card' | 'glossary' | 'kahoot_playlist';
  currentPublishedRevisionId?: string;
  createdAt: string;
  archivedAt?: string;
}

interface ContentRevision<TPayload> {
  id: string;
  contentItemId: string;
  schemaVersion: number;
  revisionNumber: number;
  payload: TPayload;
  state: ContentRevisionState;
  source: ContentSource;
  objectiveIds: string[];
  topicIds: string[];
  language: string;
  createdBy: ActorRef;
  createdAt: string;
  supersedesRevisionId?: string;
}
```

## 5.2 Question payload

Required fields:

- stable question/content ID;
- question type;
- Ukrainian text or target locale;
- options/typed answer model;
- explicit correct answer representation;
- explanation;
- difficulty;
- objective/topic mapping;
- Scripture references;
- source/evidence status;
- ambiguity and sensitivity flags;
- answer-rationale metadata;
- publication eligibility fields.

`correctIndex` may exist for multiple choice presentation, but invalid values are never normalized to zero.

## 5.3 Lesson payload

Lessons consist of typed blocks defined in Phase 3. Content Studio must validate:

- supported block types;
- objective mapping;
- block order;
- Scripture references;
- media assets and alt text;
- summary/assessment alignment;
- locale consistency;
- required editorial metadata.

## 5.4 Scripture evidence

For every exact quotation, store:

- normalized reference;
- translation/source ID;
- retrieved text hash or source evidence;
- retrieval time/version;
- quote range;
- whether content is exact, shortened or paraphrased;
- verification result;
- reviewer decision.

Do not claim a quotation is exact if it is paraphrased.

---

## 6. Validation pipeline

## 6.1 Schema validation

Use the Phase 2 runtime schemas. Validation rejects:

- missing required fields;
- invalid answer model;
- duplicate options;
- answer outside option range;
- empty explanation where required;
- invalid objective/topic IDs;
- unsupported language/type/difficulty;
- malformed references;
- unknown block type;
- invalid asset metadata.

## 6.2 Deterministic quality checks

Implement checks for:

- exact duplicates;
- normalized-text duplicates;
- near duplicates with configurable threshold;
- first-option bias distribution;
- answer leakage in wording;
- option length imbalance;
- suspicious repeated templates;
- missing/weak explanations;
- invalid or contradictory references;
- mixed language;
- excessive length;
- empty practice pools;
- orphan topics/objectives;
- difficulty mismatch heuristics;
- unsupported Unicode/control characters;
- broken media references.

Heuristics create warnings or quarantine according to policy. They do not auto-publish.

## 6.3 Scripture checks

- normalize book names and ranges;
- verify the reference exists;
- compare quotation to trusted adapter/source;
- detect verse mismatch;
- mark translation/license limitations;
- prevent invented references;
- record evidence and adapter version.

## 6.4 Ukrainian language checks

Automated checks may identify:

- Russianisms/mixed language;
- malformed punctuation;
- duplicated words;
- placeholder text;
- unnatural generated patterns;
- spelling warnings.

A human editor decides final naturalness and theological clarity.

## 6.5 Theological sensitivity

Create sensitivity categories, for example:

- doctrinal interpretation;
- denominational difference;
- violence/trauma;
- sexuality/relationships;
- end-times interpretation;
- divine judgment;
- mental health/spiritual counsel;
- historical reconstruction.

Sensitive items require an appropriate reviewer and cannot be auto-approved.

---

## 7. AI provider architecture

## 7.1 Provider contract

Unify Ollama, Gemini, OmniRoute and mock/testing providers behind one contract.

```ts
interface AiProvider {
  generateText(request: TextGenerationRequest): Promise<AiResult<string>>;
  generateObject<T>(request: ObjectGenerationRequest<T>): Promise<AiResult<T>>;
}
```

Result includes:

- provider;
- model;
- request ID;
- attempt;
- duration;
- token/usage data when available;
- warnings;
- raw artifact reference;
- structured parse result;
- finish reason;
- cost estimate where available.

Provider does not know how to publish content and cannot write repository files directly.

## 7.2 Model configuration

Configuration is provider-specific and explicit:

- provider;
- model;
- temperature or equivalent;
- output schema;
- timeout;
- retry policy;
- token/request budget;
- allowed task types.

Do not silently switch models in production jobs. Model changes are recorded.

## 7.3 Prompt versioning

Every AI task uses a versioned prompt/template with:

- ID/version;
- task purpose;
- input schema;
- expected output schema;
- prohibited behavior;
- examples/golden fixtures;
- language and theological constraints;
- change history.

Store prompt version with generated artifacts.

## 7.4 Mock provider

A deterministic mock provider is mandatory for:

- orchestration tests;
- retries;
- invalid output tests;
- cancellation;
- budget enforcement;
- schema parse failures;
- resumability.

---

## 8. AI/content job system

## 8.1 Job record

```ts
interface ContentJob {
  id: string;
  type: string;
  requestedBy: string;
  provider?: string;
  model?: string;
  promptVersion?: string;
  inputHash: string;
  status: 'queued' | 'running' | 'paused' | 'failed' | 'completed' | 'cancelled';
  attempt: number;
  maxAttempts: number;
  budget: JobBudget;
  checkpoint?: unknown;
  resultRef?: string;
  errorCode?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}
```

## 8.2 Requirements

- idempotent enqueue where the same input/task should not duplicate work;
- explicit retryable vs non-retryable errors;
- cancellation;
- checkpoint/resume for batch work;
- bounded concurrency;
- per-job and global budgets;
- rate limits;
- structured logs;
- artifact retention policy;
- no infinite retries;
- no synchronous long AI job inside a user request.

## 8.3 Honest progress

If actual progress is unknown, show stage/state, not a fabricated 67%.

Valid states:

- queued;
- preparing;
- generating batch N/M when known;
- validating;
- awaiting review;
- failed;
- completed.

---

## 9. Unified CLI and script migration

Create a unified entry point, for example:

```text
npm run ai -- generate-questions ...
npm run ai -- validate-content ...
npm run ai -- repair-explanations ...
npm run ai -- import-legacy ...
npm run ai -- create-kahoot-playlist ...
```

Each legacy command receives:

- mapped replacement;
- deprecation warning;
- compatibility period;
- owner;
- removal target;
- golden dataset comparison;
- explicit dry-run and apply modes.

All write operations:

- create draft/revision artifacts;
- never mutate current published files directly;
- require explicit apply/import action;
- produce machine-readable reports.

Read-only analysis scripts may remain separate when useful, but they must consume canonical schemas/repositories.

---

## 10. Protected Content Studio

## 10.1 Deployment/security boundary

Content Studio is a protected surface and may be:

- a separately built route/bundle;
- a separate deployment using the same backend;
- or an internal app inaccessible to normal users.

Required:

- verified authentication;
- server RBAC;
- permission-specific routes;
- no reliance on hidden navigation;
- audit log;
- rate limiting;
- session timeout/revocation;
- production CSP/security headers;
- no privileged secrets in the browser.

## 10.2 Studio modules

### Dashboard

- queue counts;
- failed jobs;
- review workload;
- publication status;
- content quality alerts;
- no vanity AI metrics.

### Draft/import workspace

- upload/import preview;
- schema mapping;
- source/provenance;
- dry-run validation;
- duplicate preview;
- quarantine reasons.

### Job dashboard

- provider/model/prompt version;
- status;
- attempts;
- duration/usage/budget;
- logs with secrets removed;
- cancel/resume/retry actions according to permission.

### Review queue

- filters by type/topic/objective/language/sensitivity;
- validation warnings;
- reviewer assignment;
- status and age;
- batch actions only where safe.

### Review editor

- side-by-side old/new diff;
- question/lesson preview using production renderer;
- Scripture reference evidence;
- option/correct answer inspection;
- explanation and objective alignment;
- comments/change requests;
- approval with explicit confirmation.

### Publication

- selected approved revisions;
- dependency checks;
- generated published snapshot/version;
- scheduled publication if supported;
- rollout/rollback;
- immutable audit record.

### Content history

- all revisions;
- actor/action timeline;
- user reports;
- superseded/archived states;
- rollback entry.

---

## 11. Review workflow and permissions

Suggested permissions:

- `content.draft.create`;
- `content.import`;
- `content.ai.run`;
- `content.review`;
- `content.approve`;
- `content.publish`;
- `content.rollback`;
- `content.audit.read`.

Separation rules:

- generator does not automatically approve its own output;
- approval and publication may require different roles for sensitive production content;
- bulk approval is restricted and audited;
- publisher sees all unresolved blockers;
- rollback does not delete the bad revision.

For a small team, one human may hold multiple roles, but the software still records separate actions.

---

## 12. Legacy content audit and migration

## 12.1 Inventory

Produce counts by:

- content file/source;
- theme/topic/objective;
- difficulty;
- question type;
- language;
- reference presence;
- explanation presence;
- validation state;
- duplicate group;
- first-answer distribution;
- bundle size;
- active consumer route/mode.

## 12.2 Classification

Every legacy item becomes:

- reviewed and publishable after evidence;
- valid but awaiting review;
- needs repair;
- duplicate/superseded;
- invalid/quarantined;
- unsupported/out of scope.

Do not mark all imported data `published` merely to preserve current behavior.

## 12.3 Migration waves

Recommended order:

1. high-use core practice pools;
2. content required by Phase 3 learning plans;
3. Kahoot/common group playlists;
4. remaining themes;
5. rare/experimental content;
6. archive unsupported files.

Each wave has before/after metrics and rollback.

## 12.4 Compatibility

During migration, the learning service may serve:

- approved canonical content;
- explicitly labeled legacy content only where policy allows;
- no mixed answer keys from two repositories in one session.

---

## 13. Publication architecture

## 13.1 Published set

Publication creates an immutable version/hash containing:

- item revision IDs;
- objective/topic mapping;
- localization/translation versions;
- asset references/hashes;
- generated indexes;
- compatibility schema version;
- publication timestamp and actor.

## 13.2 Atomicity

A publication either becomes active completely or not at all. Do not update several question files sequentially in production.

## 13.3 Cache invalidation

Clients use the published version to:

- cache immutable content;
- invalidate indexes;
- resume sessions against the original revision;
- avoid mixing revisions mid-session.

## 13.4 Rollback

Rollback switches the active published set to a previous validated version and records the incident. Existing sessions retain their referenced revision or follow an explicit invalidation policy for severe errors.

---

## 14. User content error reports

Phase 3 should expose a report action. Phase 4 implements workflow:

- authenticated report;
- content revision/session context;
- category: wrong answer, wording, translation, reference, offensive/sensitive, technical;
- optional comment with privacy limits;
- duplicate report grouping;
- reviewer queue;
- resolution status;
- optional user acknowledgement;
- audit link to resulting revision.

Reports do not directly change content or reveal other users.

---

## 15. Content Studio motion and UX

Use shared Phase 3 design/motion with a restrained productivity tone.

Allowed:

- clear queued/running/failed/completed state transitions;
- list/diff panel motion;
- progress only when measurable;
- toast/dialog confirmations;
- publication success with subtle feedback.

Avoid:

- confetti for AI generation;
- glowing “AI wisdom” treatment;
- decorative motion during Scripture review;
- fake typewriter AI output;
- motion that hides diff changes;
- automatic scrolling during review.

Reduced motion, keyboard navigation and focus management are mandatory.

---

## 16. API contracts

Potential internal routes:

```text
GET    /api/v1/content/revisions
POST   /api/v1/content/drafts
POST   /api/v1/content/imports
POST   /api/v1/content/jobs
GET    /api/v1/content/jobs/:id
POST   /api/v1/content/jobs/:id/cancel
POST   /api/v1/content/revisions/:id/validate
POST   /api/v1/content/revisions/:id/request-review
POST   /api/v1/content/revisions/:id/approve
POST   /api/v1/content/publications
POST   /api/v1/content/publications/:id/rollback
GET    /api/v1/content/audit
```

All require permissions and use versioned schemas/idempotency where applicable.

Public user APIs expose published content only and never internal AI raw artifacts or review comments.

---

## 17. Data storage and retention

Store:

- content items/revisions;
- validation findings;
- review comments/decisions;
- publication sets;
- audit events;
- AI jobs and safe metadata;
- raw generated artifacts according to retention policy;
- prompt/model versions;
- Scripture evidence;
- user reports.

Define retention for:

- raw provider responses;
- potentially sensitive prompts;
- failed artifacts;
- logs;
- exports;
- deleted/archived content.

Do not store provider secrets or unnecessary personal data in artifacts.

---

## 18. Observability and metrics

Operational metrics:

- job queue time/duration/failure;
- provider/model error rate;
- validation failure categories;
- review time;
- publication frequency/failure;
- rollback incidents;
- content error report rate;
- duplicate rate;
- empty-pool alerts;
- cost/usage budgets.

Quality metrics support review but do not automatically certify theological correctness.

---

## 19. Testing strategy

### Schema/validator tests

- valid/invalid question types;
- out-of-range answer;
- duplicate options;
- missing explanation/reference/objective;
- invalid lesson block;
- mixed language;
- malformed import;
- unknown schema version.

### AI orchestration tests

- deterministic mock success;
- invalid JSON/object;
- timeout;
- retry budget;
- cancellation;
- resume checkpoint;
- duplicate input idempotency;
- provider switch recorded;
- cost limit enforced.

### Review/publication integration

- draft to validation;
- validation failure blocks review/publication;
- role permissions;
- reviewer change request;
- approval;
- atomic publication;
- client receives new version;
- rollback restores previous set;
- existing session revision consistency.

### Security

- normal user cannot access Studio;
- reviewer cannot publish without permission;
- hidden route does not bypass RBAC;
- exported data excludes secrets;
- audit log cannot be modified through public API;
- direct file mutation route disabled in production.

### Golden datasets

Maintain reviewed fixtures for:

- Ukrainian wording;
- Scripture references;
- duplicate detection;
- classification;
- explanations;
- difficulty;
- prompt output comparison.

---

## 20. Feature flags and rollout

Suggested flags:

- `canonicalContentWrites`;
- `contentStudioEnabled`;
- `aiJobsV2`;
- `publishedContentSetV2`;
- `legacyQuestionFilesReadOnly`;
- `userContentReports`.

Rollout:

1. create schemas/repositories;
2. import in dry-run;
3. internal Studio only;
4. validate core content wave;
5. publish staging version;
6. compare user sessions against legacy;
7. enable canonical published reads for internal users;
8. percentage rollout;
9. make legacy files read-only;
10. deprecate old write scripts/routes.

---

## 21. Conflicts and interactions

### Phase 3 learning

Phase 4 must not redesign lesson/practice UI. It supplies approved revisions and reports to the existing renderer.

### Phase 5 social/Kahoot

Kahoot playlists and shared content use the canonical publication lifecycle. Community leaders cannot publish arbitrary unreviewed global content. Private custom content needs a separate policy and permissions.

### Phase 6 monetization

Do not sell unreviewed AI-generated content. Paid content packs require the same review/publication standard and entitlement mapping.

### Phase 7 offline/cache

Published immutable sets and asset hashes must be cacheable. Rollback/version invalidation must work offline honestly.

### Theological conflict

AI/provider confidence does not replace human review. Where interpretations differ, content should state context or remain neutral according to approved policy.

### Legal/licensing conflict

Bible translations, images and imported content may have license constraints. Publication requires rights metadata and removal capability.

---

## 22. Forbidden shortcuts

- AI auto-publish;
- direct mutation of published JSON;
- converting invalid correct answer to option zero;
- approving in bulk without viewing blockers;
- marking imported legacy content reviewed;
- storing only the newest version;
- hiding provider/model/prompt version;
- retrying without budget;
- fake percentage progress;
- publishing exact Scripture quotations without source evidence;
- exposing Content Studio through a frontend-only admin check;
- allowing user reports to overwrite content;
- treating grammatical validation as theological validation.

---

## 23. Definition of Done

Phase 4 is complete when:

1. Canonical content item/revision/publication schemas are in production.
2. AI output cannot become published without validation and human approval.
3. Invalid answer indices and critical schema errors are rejected/quarantined.
4. Content Studio is protected by RBAC and audit logs.
5. Review, approval, publication and rollback are separate operations.
6. Published content sets are immutable, versioned and atomically activated.
7. Scripture evidence is stored and reviewable.
8. Legacy question banks have an inventory/classification and core migration waves are complete.
9. User-facing Phase 3 flows consume canonical published revisions.
10. Existing sessions remain revision-consistent across publication changes.
11. AI jobs support budgets, retries, cancellation, checkpoint/resume and deterministic tests.
12. Legacy write scripts/routes are removed, read-only or clearly deprecated.
13. User content reports enter an auditable review workflow.
14. Security, integration, golden-dataset and rollback tests pass.
15. Documentation maps every active script/tool to the new lifecycle.

---

## 24. Rollback

Rollback options:

- switch active publication set to the last good version;
- disable Content Studio write operations while retaining read/audit access;
- pause AI job queues;
- preserve draft/review artifacts;
- keep legacy read snapshot during the migration window;
- never restore unsafe direct public writes;
- retain audit trail and incident notes.

---

## 25. Handoff to Phase 5

Phase 5 receives:

- reviewed/published questions and playlists;
- canonical content IDs/revisions;
- safe import policy;
- leader/custom-content permission boundaries;
- report/moderation integration points;
- stable content version for realtime sessions;
- protected publication APIs.

Social and multiplayer features must reference published content revisions and cannot bypass Content Studio for global/shared material.
