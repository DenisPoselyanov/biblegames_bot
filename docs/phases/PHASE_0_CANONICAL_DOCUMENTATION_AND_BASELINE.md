# Phase 0 — Canonical Documentation and Verified Baseline

> **Priority:** P0 governance  
> **Status:** documentation implementation in progress in PR #3  
> **Canonical parent:** [`../BIBLE_GAMES_MASTER_SPECIFICATION.md`](../BIBLE_GAMES_MASTER_SPECIFICATION.md)  
> **Next phase:** Phase 1 — Production Safety & Engineering Foundation

---

## 1. Purpose

Phase 0 creates a reliable starting point for every later change. Its job is not to redesign the app or implement new runtime behavior. Its job is to make it impossible for a developer or AI agent to follow an outdated roadmap, assume that a mock feature is production-ready, or change a critical subsystem without knowing its current state.

The phase must establish:

- one canonical product specification;
- one phase order;
- one implementation index;
- an evidence-based baseline of code, routes, data, security, tests and deployment;
- a clear distinction between current behavior, target behavior and historical plans;
- traceability from requirements to code and validation;
- a stable handoff into Phase 1.

---

## 2. Verified current baseline

The verified code baseline contains a React/Vite Telegram Mini App, an Express/Socket.IO backend, a Telegram bot, local JSON/SQL adapters, question tooling and AI scripts.

Important verified entry points include:

- `src/App.tsx` — route composition, lazy pages, redirects and provider hierarchy;
- `src/components/Layout.tsx` — current four-tab shell: Home, Play, Shop, Profile;
- `src/context/PlayerContext.tsx` — current client-side progression, rewards, purchases and profile persistence;
- `src/lib/storage.ts` and Zustand stores — local profile/state fallback;
- `src/lib/motion.ts` and `src/components/motion/*` — current Framer Motion foundation;
- `src/lib/cosmeticTheme.ts` and `src/data/cosmetics.ts` — current theme model;
- `server/index.ts` — Express routes, demo endpoints, protected profile/stat routes and Socket.IO Kahoot lifecycle;
- `server/middleware/telegramAuth.ts` — current Telegram auth with unsafe header fallback;
- `server/middleware/validateBody.ts` — current profile sanitization that still accepts client-controlled economy/progression values;
- `server/db/*` — JSON and SQL storage adapters;
- `server/routes/questionsAdmin.ts` — current admin question mutation surface;
- `server/roomManager.ts` and Kahoot session files — current in-memory/realtime implementation;
- `scripts/*` — question generation, analysis, repair, import and content tooling;
- `.github/workflows/*` — current build/deploy automation;
- `package.json` and `server/package.json` — current scripts and dependencies.

Phase 0 must not claim any behavior beyond what is verified in code or tests.

---

## 3. Main problems Phase 0 resolves

### 3.1 Competing documentation

Historically the repository contained several roadmaps, task boards and AI rebuild plans with incompatible phase numbering and conflicting completion statuses. An agent could interpret an old `Completed` label as proof that the current production system was safe.

### 3.2 Documentation describing target state as current state

Examples of dangerous ambiguity:

- secure Telegram auth described although `x-user-id` remains trusted;
- real backend described while `/study/path`, `/dashboard` and `/leaderboard` still contain demo/in-memory behavior;
- completed economy described although the client still calculates coins and purchases;
- completed AI/content platform described although scripts may still mutate JSON directly;
- completed design system described although the runtime default remains the legacy `classic` theme.

### 3.3 Missing evidence standard

Build success, existing screens and a large amount of code were previously treated as sufficient proof of completion. Phase 0 introduces a stricter evidence model.

---

## 4. Target documentation architecture

```text
docs/
├── README.md
├── BIBLE_GAMES_MASTER_SPECIFICATION.md
├── AI_AGENT_MASTER_EXECUTION_PROMPT.md
├── PHASE_STATUS.md
├── DECISIONS.md
├── DESIGN_RULES.md
├── MOTION_SYSTEM.md
├── PHASE_3_REBRANDING_AND_THEME_SYSTEM.md
├── MONETIZATION_STRATEGY.md
├── DEVELOPER_GUIDE.md
├── LOCAL_TOOLS.md
├── SUPABASE_SETUP.md
├── AI_SETUP.md
├── phases/
│   ├── README.md
│   └── PHASE_0...PHASE_8 implementation files
└── archive/
    └── historical plans, audits and replaced prompts
```

### Authority order

1. `BIBLE_GAMES_MASTER_SPECIFICATION.md` — product, priorities, architecture and phase order.
2. Accepted ADRs in `DECISIONS.md`.
3. Active domain specification for the relevant concern.
4. Detailed Phase implementation file in `docs/phases/`.
5. Actual code and verified tests.
6. Operational guides.
7. Archive documents have no active authority.

If a detailed implementation file conflicts with the master specification, the master specification wins. If documentation conflicts with code, the discrepancy must be reported and resolved; code is not automatically assumed correct or safe.

---

## 5. Workstreams

## 5.1 Repository inventory

Produce and maintain an inventory of:

- frontend routes and redirects;
- layout/navigation behavior;
- provider hierarchy;
- API calls and request headers;
- Express routes and middleware;
- Socket.IO events;
- persistence adapters;
- profile/progression/economy ownership;
- question loaders and content sources;
- admin mutations;
- AI scripts and providers;
- build, lint, typecheck and test commands;
- deployment workflows;
- environment variables;
- feature flags;
- known demo data and hardcoded responses.

The inventory should link to actual files and include the reviewed commit SHA.

## 5.2 Route and screen map

Document each existing route as one of:

- functional and production-backed;
- functional but client-authoritative;
- mock/demo;
- partially implemented;
- redirect/compatibility route;
- admin/internal;
- deprecated;
- planned only.

The route map must include current nested quiz routes, Kahoot routes, social routes, Shop, Admin and legacy redirects from `src/App.tsx`.

## 5.3 Data ownership map

For each important value, document current owner and target owner:

| Value | Current owner | Target owner |
|---|---|---|
| Telegram identity | client header + optional initData validation | verified server auth context |
| coins | client profile calculation | server wallet ledger |
| rank/wisdom | client progression functions | authoritative progression service |
| achievements | client unlock logic | server grant event |
| active theme | profile/local state | server profile preference + entitlement validation |
| Kahoot score | RoomManager memory | authoritative realtime session persistence |
| published questions | JSON/SQL mixed loaders | canonical content repository |
| AI-generated content | scripts/files | staging/review/publication lifecycle |

The map is mandatory because later migrations depend on it.

## 5.4 Security baseline

Document confirmed risks without attempting to hide them:

- fail-open auth when token/initData is missing;
- identity checked against a header controlled by the same client;
- admin route enable flag without full RBAC;
- profile PUT accepting coins, unlocks, rank, achievements and progress;
- public/demo endpoints mixed into the same server;
- Socket.IO host/player identity not unified with verified Telegram identity;
- JSON writes and session persistence limitations;
- lack of rate limiting and comprehensive audit logs.

Each risk receives:

- severity;
- affected files;
- exploit or failure scenario;
- target phase;
- required test proving closure.

## 5.5 Engineering baseline

Run and record:

```text
npm ci
npm run lint
npm run build
npm run smoke-audit
npm run test-classification
npm run test-social
npm run test-kahoot
npm run server or server typecheck equivalent
```

Phase 0 records failures; it does not falsely mark the phase incomplete because Phase 1 owns repairs. However, the baseline must be reproducible.

Create or plan canonical scripts that later become:

```text
npm run typecheck
npm run typecheck:server
npm run test
npm run test:integration
npm run check
```

## 5.6 Content baseline

Record:

- number of question files and themes;
- large bundles/chunks;
- invalid or fallback `correctIndex` behavior;
- duplicate rate;
- first-option bias;
- language problems;
- missing explanations/references;
- published vs unreviewed ambiguity;
- exact loaders used by Quiz, Kahoot and scripts.

This baseline becomes the input to Phase 4.

## 5.7 Deployment baseline

Document the current truth:

- frontend may deploy statically;
- API, bot and Socket.IO require separate runtime deployment;
- GitHub Pages does not represent the complete production stack;
- production environment variables and storage provider must be explicit;
- no documentation may imply that a successful static build means the backend is deployed.

---

## 6. Documentation quality rules

Every active document must clearly state:

- status: active, accepted, planned, historical or deprecated;
- owner phase;
- reviewed code baseline;
- whether it describes current or target state;
- dependencies;
- links to canonical parent documents;
- what it does not define.

Avoid:

- duplicate complete checklists in multiple files;
- the word `completed` without evidence;
- hidden assumptions about database/provider/deployment;
- instructions that weaken production security;
- stale file paths;
- naming only Codex when Claude Code and other agents are supported;
- unbounded “implement everything” prompts without rollout and rollback.

---

## 7. Conflict management

### Conflict: historical docs vs canonical roadmap

Resolution: historical files live in `docs/archive/` and begin with a warning that they are not active requirements.

### Conflict: code vs desired architecture

Resolution: implementation plans explicitly label target changes. They never rewrite history by pretending target architecture already exists.

### Conflict: one large master file vs maintainability

Resolution: the master file keeps authority and phase order; domain specs and detailed phase plans contain implementation detail without creating new numbering.

### Conflict: documentation-only PR vs runtime urgency

Resolution: Phase 0 remains documentation-only. Security fixes start immediately after merge in Phase 1, preventing design or feature work from hiding critical changes in the same PR.

### Conflict: generated documentation vs human decisions

Resolution: AI agents may draft and update documentation, but product, financial, legal, security and doctrinal decisions require explicit owner or accepted ADR approval.

---

## 8. Versioning and traceability

Each future Phase execution should record:

- source branch and commit SHA;
- implementation file version or last modified commit;
- ADRs applied;
- migration IDs;
- feature flags;
- test evidence;
- rollout status;
- known limitations;
- next phase handoff.

The `PHASE_STATUS.md` file remains short. It must link to evidence rather than duplicate all implementation detail.

---

## 9. Validation

Phase 0 validation includes:

- all active links resolve;
- no active file references old `docs/product-rebuild/` paths;
- no active roadmap uses Phase numbers that conflict with 0–8;
- archived files have explicit historical status;
- master specification links to every detailed phase file;
- AI execution prompt instructs agents to read the relevant phase plan;
- README links to `docs/README.md` instead of duplicating the full specification;
- current risks are not presented as resolved;
- PR diff contains documentation only unless a separately approved fix is required.

---

## 10. Deliverables

- canonical master specification;
- decisions log with accepted ADRs;
- active documentation index;
- archive index;
- verified current-state audit;
- Phase 0–8 detailed implementation plans;
- neutral AI agent execution prompt;
- design, motion and monetization domain specs;
- concise Phase status document;
- updated root README;
- draft PR containing the documentation consolidation.

---

## 11. Acceptance criteria

Phase 0 is complete when:

1. A developer can find the current roadmap from the root README in no more than two clicks.
2. There is only one active Phase numbering system.
3. Historical plans cannot be mistaken for active work.
4. Every Phase 0–8 has a separate implementation file.
5. The current application, backend, bot, content and deployment baselines are honestly described.
6. Confirmed security and data-integrity issues remain visible and assigned to Phase 1.
7. Design, motion, AI/content and monetization decisions link to their owner phases.
8. Codex and Claude Code receive the same canonical instructions.
9. All active documentation links are valid.
10. The documentation PR is reviewable and mergeable.
11. Runtime code has not been silently changed under a documentation commit.
12. `PHASE_STATUS.md` identifies Phase 1 as the next active implementation.

---

## 12. Rollback

Documentation rollback should preserve history rather than delete it. If a new structure proves unusable:

- restore links through redirects or compatibility notes;
- keep archived documents available;
- never revive conflicting completion statuses;
- create a new ADR before changing phase authority;
- retain the verified audit and evidence gathered during Phase 0.

---

## 13. Handoff to Phase 1

The Phase 1 execution brief must start from the exact baseline captured here and prioritize:

1. fail-closed identity;
2. authorization/RBAC;
3. client-authoritative economy and progression removal;
4. CI/type/test gates;
5. transactional data safety;
6. isolation of demo/admin surfaces;
7. authoritative event IDs required by future motion and reward flows.

No Phase 3 redesign, Phase 4 AI expansion or Phase 6 monetization implementation may begin while Phase 1 release blockers remain open, except isolated design exploration that does not enter production code.
