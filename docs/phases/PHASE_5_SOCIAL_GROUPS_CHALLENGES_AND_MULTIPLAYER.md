# Phase 5 — Social, Groups, Challenges & Multiplayer

> **Priority:** P2 growth  
> **Depends on:** Phase 1 secure identity/RBAC, Phase 2 domain/realtime contracts, Phase 3 shared UI/motion, Phase 4 published content lifecycle  
> **Canonical parent:** [`../BIBLE_GAMES_MASTER_SPECIFICATION.md`](../BIBLE_GAMES_MASTER_SPECIFICATION.md)

---

## 1. Product outcome

After Phase 5, Bible Games supports real communities, friend challenges, leaderboards and Kahoot-style multiplayer backed by persistent server state and explicit privacy/moderation rules.

The phase must ensure that:

- group membership and roles are server-authoritative;
- challenge rules, scores and rewards cannot be forged by clients;
- Kahoot rooms survive expected reconnect scenarios;
- timers and score calculation use server time/state;
- participant identity is bound to authenticated users or clearly controlled guest policy;
- leaderboards contain real eligible users, not virtual placeholders;
- group and session content references approved published revisions;
- non-winners receive respectful result UX;
- moderation, reporting, removal and audit exist before public social growth.

---

## 2. Current baseline and risks

The repository already contains:

- social routes and screens for challenges/communities;
- Kahoot hub, creation, join, room, display, playlists and editor routes;
- Socket.IO client/server integration;
- `RoomManager` handling room lifecycle in memory;
- session export/history utilities;
- payload-supplied host/player names and Telegram IDs;
- in-memory or local persistence patterns;
- current visual/motion prototypes.

Important risks:

- socket identity may not be bound to verified Telegram principal;
- room host authority may depend on socket IDs and client payloads;
- server restart can lose active room state;
- reconnect can duplicate participants or replay old events;
- timers can drift if clients count independently;
- playlists/imported questions can bypass content review;
- social demo data may look like production data;
- leaderboards can leak identity or encourage unhealthy competition;
- challenge rewards could duplicate through retry or concurrent completion;
- group roles/moderation are not yet a mature domain.

---

## 3. Product and ethical principles

1. Social features support learning and fellowship rather than engagement at any cost.
2. Communities are private/invite-based by default unless public discovery is explicitly approved.
3. Real names, usernames and profile photos are not exposed beyond the chosen privacy scope.
4. Competition does not shame low-ranked users.
5. Children/minors require conservative privacy defaults and moderation controls.
6. Final score/reward is server-authoritative.
7. Reconnect restores state rather than creating a second participant or second victory.
8. Community leaders do not gain global content publication rights automatically.
9. Reports and bans are auditable and appeal/review rules are documented.
10. Social notifications are opt-in and rate-limited.

---

## 4. Domain model

## 4.1 Communities

```ts
interface Community {
  id: string;
  name: string;
  description?: string;
  type: 'church' | 'youth_group' | 'study_group' | 'private_group';
  visibility: 'private' | 'invite_only' | 'discoverable';
  ownerUserId: string;
  activeLearningPlanId?: string;
  createdAt: string;
  archivedAt?: string;
  version: number;
}
```

## 4.2 Membership

```ts
interface CommunityMembership {
  id: string;
  communityId: string;
  userId: string;
  role: 'owner' | 'leader' | 'moderator' | 'member';
  status: 'invited' | 'active' | 'left' | 'removed' | 'banned';
  joinedAt?: string;
  createdAt: string;
}
```

Membership changes are commands with audit records. A hidden screen or invite link alone does not grant access.

## 4.3 Invitations

Invitation record includes:

- stable ID/token hash;
- community/challenge target;
- creator;
- allowed uses;
- expiry;
- revoked/accepted state;
- optional intended user;
- deep-link metadata;
- audit events.

Do not store reusable plain invite secrets unnecessarily.

## 4.4 Challenges

```ts
interface Challenge {
  id: string;
  type: 'friend' | 'community' | 'weekly' | 'event';
  createdBy: string;
  communityId?: string;
  opponentUserId?: string;
  rules: ChallengeRules;
  contentSetVersion: string;
  startsAt: string;
  endsAt: string;
  status: 'draft' | 'invited' | 'active' | 'completed' | 'cancelled' | 'expired';
  rewardPolicyId?: string;
}
```

Rules include objective/topic, question count, timer, attempts, scoring version, eligibility and tie handling.

## 4.5 Leaderboards

Leaderboard definition includes:

- scope: challenge/community/season/global;
- eligible event types;
- scoring version;
- start/end time;
- privacy/display-name policy;
- tie-breakers;
- moderation exclusions;
- pagination/caching policy.

Do not derive all-time public ranking from arbitrary profile totals.

---

## 5. Community lifecycle

## 5.1 Creation

Creation requires authenticated user and product policy eligibility. Validate:

- name/description length and language;
- type and visibility;
- creation limits;
- prohibited content;
- owner account status;
- initial moderation settings.

Create community and owner membership transactionally.

## 5.2 Joining

Join flow:

1. validate invitation/discovery eligibility;
2. check ban/removal state;
3. enforce member limits;
4. create/activate membership idempotently;
5. audit;
6. return updated community projection and event ID;
7. UI animates member count/avatar only after server confirmation.

## 5.3 Leaving/removal

Rules:

- owner cannot leave without ownership transfer or archive;
- moderator cannot remove equal/higher role without permission;
- removal and ban are different states;
- removed user loses protected content/feed access;
- historical aggregate progress remains according to privacy policy;
- audit reason is required for moderation actions.

## 5.4 Roles

Role assignment is explicit and server-authorized. Community role does not grant global admin/content publication permissions.

## 5.5 Archive/delete

Prefer archive with retention policy. Hard deletion depends on privacy/legal requirements and must handle memberships, challenges, posts/announcements and audit data.

---

## 6. Community product surfaces

## 6.1 Communities overview

Show:

- user communities;
- pending invitations;
- recommended/discoverable communities only if enabled;
- active group learning/challenge summary;
- create/join actions based on permissions;
- loading/empty/error/offline states.

No fake avatars or activity in production.

## 6.2 Community detail

Tabs/sections may include:

- Overview/Feed;
- Learning plan;
- Challenges;
- Leaderboard;
- Members;
- Settings for authorized roles.

The exact navigation follows mobile constraints and should not duplicate the main bottom navigation.

## 6.3 Announcements/activity

Activity entries are generated from authoritative domain events such as:

- member joined;
- plan assigned;
- challenge started/completed;
- approved announcement;
- milestone shared according to user privacy.

Avoid exposing every answer or sensitive spiritual activity.

## 6.4 Group learning progress

Display aggregate metrics only when privacy policy permits. Leaders may see assignment/completion status according to role, not unrestricted personal answer history.

---

## 7. Friend challenge implementation

## 7.1 Friend/opponent resolution

Use internal user IDs resolved through allowed contacts/invitations. Do not allow arbitrary Telegram ID input to target users.

## 7.2 Configuration

Configurable fields may include:

- mode;
- objective/topic;
- reviewed content set;
- question count;
- time per question;
- start/deadline;
- number of attempts;
- XP stake/reward only if Phase 6 policy allows;
- private/public result visibility.

Every field is bounded by server rules.

## 7.3 Send/accept/decline

State transitions are idempotent and authorized:

```text
draft → invited → accepted → active → completed
               ↘ declined | expired | cancelled
```

The sender cannot accept for the opponent. Cancellation rules depend on state.

## 7.4 Completion

Server compares authoritative session outcomes and applies tie-break rules. Reward event is created once. Both users receive the same final challenge version and result event.

## 7.5 Abuse controls

- invitation rate limits;
- block/report user;
- challenge spam controls;
- no repeated XP farming against the same account;
- eligibility/cooldown;
- account/device anomaly monitoring;
- no client-provided final score.

---

## 8. Kahoot/realtime architecture

## 8.1 Process separation

Refactor current socket handlers into:

- authenticated Socket.IO middleware;
- typed event gateway;
- room/game service;
- room repository;
- timer/clock service;
- score service;
- publication/content resolver;
- session export service;
- cleanup/recovery worker.

Transport handlers should validate, authorize, call services and emit typed results. They should not contain all game logic.

## 8.2 Identity modes

Possible modes:

### Authenticated participant

- Telegram identity verified;
- stable internal user ID;
- eligible for persistent stats/rewards according to rules.

### Controlled guest

Allowed only if product owner approves classroom use without Telegram account. Guest must have:

- room-scoped ephemeral ID;
- host approval/rules;
- no global rewards/account progression;
- safe display-name policy;
- expiry and cleanup;
- no ability to impersonate registered users.

Do not mix guest and authenticated identities silently.

## 8.3 Room model

```ts
interface RealtimeRoom {
  id: string;
  code: string;
  hostUserId: string;
  contentSetVersion: string;
  playlistRevisionId: string;
  settings: RoomSettings;
  phase: RoomPhase;
  phaseStartedAt?: string;
  sequence: number;
  status: 'lobby' | 'active' | 'completed' | 'closed' | 'expired';
  createdAt: string;
  expiresAt: string;
}
```

Participant state is separate and keyed by stable participant ID, not socket ID.

## 8.4 Room code

- human-readable code is unique only while active;
- internal room ID is permanent;
- code generation avoids predictable abuse where necessary;
- joining is rate-limited;
- expired/closed code returns explicit state;
- display/host routes use authorization or signed room tokens.

## 8.5 Host permissions

Only host or delegated co-host can:

- update allowed settings;
- start game;
- advance phase;
- remove participant;
- close room;
- export detailed results.

The server checks principal/role for every event.

## 8.6 Published content binding

Room creation resolves a reviewed playlist/content revision. Once started, the room uses a fixed content set/version. Publication updates do not change questions mid-game.

Private custom playlists require Phase 4 review/import policy and visibility rules.

---

## 9. Realtime event contract

Every event envelope contains:

```ts
interface RoomEvent<T> {
  eventId: string;
  roomId: string;
  sequence: number;
  serverTime: string;
  type: string;
  payload: T;
}
```

Client commands include:

- command ID/idempotency key;
- expected room version/sequence where appropriate;
- payload schema version.

Server response distinguishes:

- accepted;
- duplicate/replayed;
- stale state;
- unauthorized;
- invalid phase;
- rate limited;
- room closed/expired.

---

## 10. Room lifecycle

## 10.1 Create

- validate host permission and settings;
- resolve playlist revision;
- create room transactionally;
- create host participant/role;
- return room code and state;
- audit.

## 10.2 Join

- validate code/status/capacity;
- resolve authenticated or guest identity;
- enforce unique participant policy;
- create or restore participant;
- broadcast one join event;
- return current snapshot and sequence.

## 10.3 Reconnect

Reconnect uses a stable participant/session token, not only name. It:

- binds new socket to existing participant;
- revokes/updates old connection as policy requires;
- returns current state, server time and latest sequence;
- does not emit another “joined” or replay old victory;
- preserves submitted answer state.

## 10.4 Start

- only valid in lobby;
- freeze participant eligibility if required;
- resolve all content;
- set authoritative start time;
- emit countdown/start event;
- persist snapshot/event.

## 10.5 Question/answer

- server controls phase start/end time;
- client submits option once according to rules;
- receive time is server timestamp;
- duplicate submit returns original result/ignored state;
- answer key remains server-side until reveal;
- score uses versioned formula;
- late answers handled explicitly;
- participant cannot answer future/previous question.

## 10.6 Advance/reveal

Advance is host-controlled or automatic according to settings. Server persists phase transition, computes authoritative result and emits sequence.

## 10.7 Complete

- final placement and scores computed once;
- tie policy applied;
- `GameOutcome` events created;
- progression/rewards applied idempotently;
- session export summary stored;
- victory motion keyed to event ID;
- room becomes read-only/completed before expiry.

## 10.8 Close/expire

- explicit host close or TTL worker;
- disconnect cleanup does not immediately destroy recoverable room;
- retention policy for results;
- public code invalidated;
- sockets notified.

---

## 11. Timer and clock synchronization

Clients never trust a local countdown starting at receipt time.

Server state provides:

- `serverTime`;
- phase start timestamp;
- phase duration/end timestamp;
- sequence/version.

Client estimates offset and renders remaining time. On reconnect/background restore it recalculates from server state.

Tests cover:

- network latency;
- device sleep;
- browser background throttling;
- clock changes;
- reconnect near deadline;
- duplicate start events.

---

## 12. Scoring and rewards

## 12.1 Scoring version

Every room/challenge stores a scoring policy/version. Formula changes do not rewrite historical results.

Inputs may include:

- correctness;
- authoritative response time;
- streak/bonus according to product rules;
- no client-calculated score.

## 12.2 Rewards

Rewards are optional and controlled by Progression/Economy domains. Guard against:

- self-host farming;
- repeated same-playlist farming;
- collusion;
- guest reward abuse;
- room restart duplication;
- concurrent completion.

Reward event IDs are unique and auditable.

## 12.3 Non-winner UX

Results emphasize:

- personal place;
- correct answers;
- learning topics;
- improvement/progress;
- next action.

Avoid red “defeat” treatment or shame messaging.

---

## 13. Leaderboards

## 13.1 Types

- challenge leaderboard;
- room leaderboard;
- community weekly/seasonal leaderboard;
- optional global leaderboard only after privacy/abuse review.

## 13.2 Eligibility

Exclude or flag:

- guests where inappropriate;
- banned/suspended users;
- test/demo accounts;
- invalidated sessions;
- suspected abuse pending policy;
- private users from public display.

## 13.3 Display identity

Use user-selected display policy:

- display name;
- initials/pseudonym;
- hidden from global scope;
- avatar visibility.

Never expose Telegram username/ID by default.

## 13.4 Pagination/caching

Leaderboard queries are paginated, scoped and cacheable with version/updated time. User rank may be fetched separately without loading the full board.

---

## 14. Moderation and safety

Required capabilities:

- report community/user/content/activity;
- block user;
- mute/limit invitations;
- remove member;
- ban from community;
- suspend community;
- audit moderation action;
- appeal/review policy if public scale requires;
- content/announcement filters and manual review tools.

Do not build unrestricted direct messaging in this phase unless separately approved with safety design.

For minors:

- minimal public profile;
- private groups by default;
- leader/admin accountability;
- no precise activity exposure;
- notification limits;
- legal/privacy review before broader discovery.

---

## 15. Notifications and deep links

Potential events:

- community invitation;
- challenge invitation/accepted/deadline;
- room ready/start reminder;
- leader announcement;
- group plan assignment.

Rules:

- opt-in/preferences;
- rate limits/digest options;
- no sensitive answer/spiritual details in notification text;
- deep link validates access on open;
- revoked invite does not grant access;
- bot uses backend notification service rather than direct business logic.

---

## 16. UI and motion implementation

Follow Phase 3 design and `MOTION_SYSTEM.md`.

### Communities

- member join animation only after server confirmation;
- activity feed uses controlled list motion;
- role/settings changes use restrained feedback;
- no fake online indicators.

### Challenge

- send/accept/decline state transitions;
- avatars/VS treatment remains calm;
- result uses authoritative event;
- no aggressive fighting visuals.

### Kahoot lobby

- participant join `fade/scale`;
- count update;
- one ready highlight, no permanent pulse;
- reconnect does not replay join.

### Countdown/timer

- server synchronized;
- reduced-motion numeric fallback;
- no flashing.

### Answer reveal/leaderboard

- correct/wrong accessible states;
- score count-up after server result;
- controlled row reordering;
- final podium only once per outcome event.

### Performance

Large rooms must limit simultaneous animated participants. Virtualize or summarize lists where required.

---

## 17. Persistence and scaling

## 17.1 Room persistence

At minimum persist:

- room metadata/settings;
- participant identities/status;
- current phase/question index/timestamps;
- submissions/results;
- sequence/events needed for recovery;
- final session summary.

An in-memory cache may accelerate active rooms, but database/event state is the recovery source according to chosen architecture.

## 17.2 Multi-instance support

Before horizontal scaling:

- room ownership/sticky sessions or shared adapter is defined;
- Socket.IO adapter/pub-sub if multiple instances;
- distributed locks or single-writer policy;
- idempotent event processing;
- cleanup worker coordination.

Do not claim horizontal scalability if only one-process memory state exists.

## 17.3 Limits

Define:

- max participants per room;
- max active rooms per host/account;
- payload size;
- event rate;
- room lifetime;
- session retention;
- export limits;
- playlist/question limits.

---

## 18. Exports and privacy

Session export permissions:

- host/authorized leader only;
- export records actor/time;
- includes only necessary fields;
- guest/private identity handling;
- CSV injection protection;
- retention/deletion policy;
- no public unauthenticated session exports.

Community/user export/delete integrates with account privacy workflows.

---

## 19. Observability

Metrics/logs:

- socket connections/auth failures;
- rooms created/active/completed/expired;
- join/reconnect success;
- duplicate participant prevention;
- event sequence gaps;
- timer drift/reconciliation;
- answer submit latency/error;
- room size;
- moderation reports/actions;
- challenge conversion/completion;
- reward idempotency conflicts;
- database/cache/realtime failures.

Logs use IDs, not raw private content or unnecessary names.

---

## 20. Tests

### Domain

- membership role transitions;
- owner transfer/archive;
- invitation expiry/revocation/use limits;
- challenge state machine;
- score/tie/reward policy;
- leaderboard eligibility/privacy;
- moderation permission.

### Realtime integration

- authenticated socket;
- guest policy;
- create/join/duplicate join;
- host-only start/advance;
- answer once;
- late/invalid phase answer;
- reconnect/new socket;
- server-time countdown;
- room recovery after process restart scenario;
- final outcome once;
- room close/expiry;
- content revision fixed during session.

### Security/abuse

- forged host ID;
- arbitrary Telegram ID payload;
- join spam/rate limit;
- challenge spam;
- export without permission;
- cross-community access;
- banned user join;
- reward replay/collusion guard fixtures.

### UI/E2E

- community empty/invited/member/leader states;
- friend challenge lifecycle;
- Kahoot host/player/display;
- background/foreground and reconnect;
- reduced/minimal motion;
- 320–430 px and presentation display;
- non-winner result;
- offline/unavailable state.

---

## 21. Feature flags and rollout

Suggested flags:

- `communitiesV1`;
- `friendChallengesV1`;
- `leaderboardsV1`;
- `secureKahootV2`;
- `guestKahoot` if approved;
- `realtimePersistenceV1`;
- `socialNotificationsV1`.

Rollout order:

1. internal/test communities;
2. secure Kahoot identity/persistence with existing UI;
3. invite-only closed alpha;
4. leader moderation tools;
5. friend challenges;
6. community challenge/leaderboard;
7. controlled broader rollout;
8. discoverability/global ranking only after safety review.

---

## 22. Conflicts and dependencies

### Phase 4 content

All shared/global playlists reference approved revisions. Community leaders cannot bypass publication. Private custom material requires a clearly separate visibility/review policy.

### Phase 6 economy

Challenge stakes/rewards and premium host features wait for economy rules. Phase 5 may emit eligible outcomes but not invent wallet logic.

### Phase 7 offline

Realtime multiplayer is unavailable offline. UI must say so. Offline queued competitive answers are not accepted unless a future explicit protocol proves fairness.

### Privacy vs analytics

Do not collect full social graphs/activity simply for growth metrics. Aggregate where possible.

### Motion vs reconnect

Consumed event IDs and room sequence prevent replaying join/podium/victory after reconnect.

### Legacy Kahoot imports

Import tools must feed Phase 4 staging/publication or private approved scope; they do not write active production playlists directly.

---

## 23. Forbidden shortcuts

- using socket ID or display name as permanent identity;
- trusting `hostTelegramId` or score from payload;
- keeping active rooms only in memory while claiming recovery;
- restarting timer on every client reconnect;
- public session CSV without auth;
- virtual/demo users in production leaderboard;
- unrestricted public communities before moderation/privacy;
- direct messaging without safety design;
- replaying reward/victory on reconnect;
- awarding guests global progression silently;
- mixing content revisions mid-room;
- hiding moderation behind frontend UI only.

---

## 24. Definition of Done

Phase 5 is complete when:

1. Communities and memberships are persisted and server-authoritative.
2. Roles, invitations, leave/remove/ban/archive workflows are authorized and audited.
3. Friend challenges have a complete state machine, anti-spam and authoritative results.
4. Leaderboards use real eligible data and privacy controls.
5. Socket.IO identity is verified or follows an explicit guest policy.
6. Host permissions are enforced server-side for every event.
7. Room/participant state survives supported reconnect and recovery scenarios.
8. Timers use server time and recover after backgrounding/reconnect.
9. Answer/score/final placement are server-authoritative and idempotent.
10. Final rewards and victory motion trigger once per event ID.
11. Rooms bind to fixed approved content revisions.
12. Session exports are protected and privacy-safe.
13. Moderation/report/block/ban controls exist before public rollout.
14. Social notifications are permissioned and rate-limited.
15. Security, realtime, recovery, abuse, UI and reduced-motion tests pass.
16. Demo social/leaderboard data is absent from production.

---

## 25. Rollback

Rollback can:

- disable community/challenge creation while preserving reads;
- prevent new room creation while allowing active-room completion;
- switch to a single-instance realtime mode if safe and documented;
- disable rewards without losing final game records;
- pause notifications/discovery;
- retain memberships, sessions, audit and moderation data;
- never restore unauthenticated host identity or client scores.

---

## 26. Handoff to Phase 6

Phase 6 receives:

- authoritative challenge/game outcome events;
- community/host roles that may qualify for premium features;
- stable user/group/session IDs;
- safe leaderboard/reward eligibility hooks;
- published content/playlist references;
- entitlement check integration points;
- audited invitation and notification infrastructure.

Phase 6 adds wallet/catalog/purchases/paid plans without embedding payment logic into RoomManager, community components or challenge scoring.
