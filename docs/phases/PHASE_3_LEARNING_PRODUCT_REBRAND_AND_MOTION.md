# Phase 3 — Learning Product, Rebrand & Motion

> **Priority:** P1 core product  
> **Depends on:** Phase 1 security and Phase 2 canonical data/API platform  
> **Binding domain specs:** [`../PHASE_3_REBRANDING_AND_THEME_SYSTEM.md`](../PHASE_3_REBRANDING_AND_THEME_SYSTEM.md), [`../DESIGN_RULES.md`](../DESIGN_RULES.md), [`../MOTION_SYSTEM.md`](../MOTION_SYSTEM.md)  
> **Canonical parent:** [`../BIBLE_GAMES_MASTER_SPECIFICATION.md`](../BIBLE_GAMES_MASTER_SPECIFICATION.md)

---

## 1. Product outcome

After Phase 3, Bible Games stops feeling like a collection of quiz modes and becomes a coherent Bible learning product.

A user opening the app should immediately understand:

- what to do today;
- which learning path is active;
- what was completed;
- what needs review;
- why the next lesson or practice is recommended;
- how progress is calculated;
- where games, groups, shop and profile fit without dominating learning.

The phase also introduces the approved rebrand:

- default theme `Світло` (`light`);
- premium spiritual minimalism;
- warm ivory, deep navy and restrained gold;
- shared semantic design tokens;
- coherent premium motion;
- accessibility and Telegram Mini App behavior;
- compatibility with future unlockable themes.

---

## 2. Current baseline and migration pressure

### Routing

`src/App.tsx` currently exposes:

- Home;
- Play Hub;
- Study Hub;
- Themes and Theme Detail;
- Quiz routes with several legacy variants;
- Profile, Shop, Stats and Admin;
- social challenge/community routes;
- Millionaire and Survival;
- a broad Kahoot route family;
- legacy redirects.

The route tree reflects product history rather than a final learning-first information architecture.

### Navigation

`src/components/Layout.tsx` currently has four bottom tabs:

- Головна;
- Гра;
- Крамниця;
- Профіль.

The approved target navigation is learning-first and must be derived from product architecture, not copied mechanically from mockups. The target is expected to use:

- Today/Home;
- Learn;
- Play;
- Progress;
- Profile.

Shop, communities and settings remain accessible through contextual routes or Profile/Play surfaces rather than occupying primary navigation automatically.

### State

The current `PlayerContext` mixes profile, progression, purchases, recommendations and theme application. Phase 3 must consume the authoritative Phase 2 APIs and reduce UI state to presentation/transient concerns.

### Visual baseline

The runtime default is still legacy `classic`. Theme variables and components were not originally built for a large paid-theme ecosystem. Phase 3 must migrate without breaking existing users or flashing from dark to light during startup.

### Motion baseline

The project already uses Framer Motion and shared variants, but the Phase 3 implementation must consolidate motion behavior rather than adding local transitions page by page.

---

## 3. Core product principles

1. Learning is the primary product; games motivate and reinforce it.
2. Today is actionable, not a decorative dashboard.
3. Every lesson and question maps to a learning objective.
4. Practice results and progress come from authoritative server outcomes.
5. No fake recommendations, fake rankings or demo users in production.
6. Rebranding changes presentation without changing security, rewards or content truth.
7. Theme architecture is semantic and reusable.
8. Motion communicates state and never blocks learning.
9. Mobile Telegram WebView is the primary interaction environment.
10. The phase must preserve old deep links through controlled redirects and analytics.

---

## 4. Target information architecture

## 4.1 Primary tabs

### Today / Головна

Purpose:

- resume active lesson;
- show due review;
- display daily plan;
- show daily verse/content only when editorially published;
- expose streak and daily goal;
- offer one optional challenge;
- summarize recent authoritative progress.

### Learn / Навчання

Purpose:

- learning plans;
- topics/objectives;
- modules and lessons;
- search/filter;
- progress by plan;
- saved/resume state.

### Play / Гра

Purpose:

- Practice;
- Review mistakes;
- Millionaire;
- Survival;
- Kahoot;
- friend challenges;
- later game modes.

Game modes clearly state whether they affect mastery, XP, leaderboard or only entertainment.

### Progress / Прогрес

Purpose:

- plan/objective mastery;
- review health;
- lesson completion;
- streak history;
- achievements;
- level/rank as secondary motivation;
- no virtual players.

### Profile / Профіль

Purpose:

- identity/preferences;
- Bible translation;
- theme/avatar;
- accessibility/motion/haptic settings;
- notifications/privacy;
- communities and account management;
- shop entry where product design decides.

## 4.2 Secondary routes

- Shop;
- Communities;
- Community detail;
- Challenges;
- Challenge detail;
- Settings;
- Achievement detail;
- Theme preview;
- Kahoot host/display/player flows;
- lesson/practice fullscreen routes.

Secondary routes do not need permanent bottom-tab slots.

---

## 5. Route migration

## 5.1 New route model

Possible target structure:

```text
/
/learn
/learn/plans/:planId
/learn/plans/:planId/modules/:moduleId
/learn/lessons/:lessonId
/practice
/practice/session/:sessionId
/review
/play
/play/millionaire
/play/survival
/play/kahoot/...
/progress
/profile
/profile/settings
/profile/themes
/shop
/social/communities
/social/challenges
```

Final naming must match React Router and deployment basename behavior.

## 5.2 Compatibility redirects

Maintain redirects from current routes:

- `/play/study`;
- `/play/study/themes`;
- `/play/study/themes/:themeId`;
- `/play/study/quiz/...`;
- `/themes/...`;
- `/quiz/...`;
- `/play/solo/...`.

Redirect mapping must preserve as much user intent as possible. When an old theme/difficulty no longer maps exactly, show an explanatory compatibility route instead of silently sending every user to Home.

## 5.3 Route analytics

Track:

- old route usage;
- redirect destination;
- failed mapping;
- exit after redirect;
- completion of the new flow.

Remove redirects only after a defined retention window.

## 5.4 Fullscreen routes

Quiz, active lesson interactions, Millionaire and Kahoot may hide the bottom navigation. This behavior must be centralized in route metadata rather than path substring checks scattered in `Layout.tsx`.

---

## 6. App shell implementation

Create an app shell that owns:

- safe-area insets;
- Telegram header/background synchronization;
- bottom navigation;
- route transition container;
- global toast/announcement region;
- offline/reconnect banner;
- modal/sheet portals;
- responsive content width;
- focus restoration;
- skip/link or accessibility navigation where applicable.

Do not nest entire screen trees inside unnecessary animated containers that create layout jank.

### Navigation state

Derive the active tab from route metadata. A route such as Community Detail may map to Profile or Play context according to the approved IA, but should not be forced into an unrelated tab because of string matching.

### Telegram integration

- BackButton follows route stack;
- MainButton is used only when it improves the flow and does not conflict with in-app CTA;
- theme colors update with active theme;
- viewport and keyboard changes use `100dvh`/safe handling;
- haptic wrapper fails safely on unsupported platforms.

---

## 7. Design-system foundation

Follow `DESIGN_RULES.md` exactly.

## 7.1 Semantic tokens

Implement tokens for:

- app/surface/elevated backgrounds;
- primary/secondary/muted/inverse text;
- brand primary;
- spiritual accent;
- border strengths;
- success/danger/warning/info;
- CTA roles;
- progress;
- navigation;
- overlays;
- shadows/elevation;
- hero treatment;
- focus rings;
- skeleton/loading;
- motion-compatible state colors.

Do not use raw navy/gold values inside product components unless building token definitions.

## 7.2 Theme schema

Target theme contract includes:

- stable ID and display metadata;
- mode/light-dark behavior;
- semantic palette;
- typography options within constraints;
- elevation/surface tokens;
- imagery asset set;
- decorative/celebration palette;
- compatibility/version field;
- accessibility audit metadata;
- asset integrity/version.

Theme cannot alter:

- information architecture;
- answer correctness;
- rewards;
- content availability;
- touch-target size;
- success/danger meaning;
- reduced-motion behavior.

## 7.3 Default theme migration

`Світло` becomes default for new users and invalid/missing theme preferences.

Migration rules:

- existing user choice remains;
- existing unlocked themes remain available;
- `classic` remains a supported legacy alternative until audited;
- startup fallback is `light` to avoid dark-to-light flash;
- profile preference updates only after entitlement validation;
- theme assets have fallback;
- rollback does not erase preferences or entitlements.

## 7.4 Shared components

Implement or standardize:

- AppPage;
- PageHeader;
- SectionHeader;
- BottomNavigation;
- HeroCard;
- ContentCard;
- ListRow;
- SearchField;
- SegmentedControl;
- Primary/Secondary/Icon buttons;
- ProgressBar/ProgressRing;
- MetricTile;
- AchievementBadge;
- AnswerOption;
- AnswerFeedback;
- Skeleton;
- Empty/Error/Offline states;
- BottomSheet/Dialog;
- ThemePreview;
- AnimatedNumber;
- CelebrationLayer.

Components expose stable APIs, semantic states and accessibility behavior. Avoid one file per trivial wrapper if that adds ceremony without reuse.

---

## 8. Motion-system implementation

Follow `MOTION_SYSTEM.md`.

## 8.1 Foundation

- consolidate motion tokens and easings;
- keep one animation package (`framer-motion` unless an explicit migration ADR changes it);
- create route/tab/fullscreen presets;
- harden MotionSheet and MotionDialog with focus/scroll/back handling;
- create reduced/minimal motion support;
- create low-end capability hook/provider;
- implement event-consumption deduplication;
- create shared progress/number/celebration primitives;
- ensure final state works without animation.

## 8.2 Core sequences

Implement:

- app launch/loading;
- screen and nested route transitions;
- lesson block transitions;
- correct answer;
- wrong answer plus correct reveal;
- next question;
- session result;
- XP/progress update;
- level/rank/achievement/streak;
- theme switching;
- settings/toggles/sheets/dialogs;
- offline/reconnect.

Major animations require authoritative event IDs from Phase 1–2.

## 8.3 Performance

- transform/opacity primarily;
- no large animated blur;
- no page-wide layout animation;
- CTA available before celebration finishes;
- timers/listeners cleaned;
- no replay after remount;
- visual fixtures for full/reduced/minimal motion.

---

## 9. Today screen

## 9.1 Server contract

`GET /api/v1/learning/today` returns an authoritative daily plan projection:

```ts
interface TodayView {
  date: string;
  timezone: string;
  activeLesson?: LessonResumeCard;
  dueReview?: ReviewCard;
  dailyGoal: DailyGoalView;
  optionalChallenge?: ChallengePreview;
  streak: StreakView;
  verseOfDay?: PublishedVerseCard;
  recentOutcome?: ProgressionSummary;
  generatedAt: string;
}
```

The client does not invent priorities from local state.

## 9.2 Priority order

1. Continue active lesson/session.
2. Due review.
3. Daily plan lesson.
4. Optional challenge.
5. Supporting verse/streak/progress.

The screen should not present six equally strong cards.

## 9.3 States

- first-time user;
- active plan;
- all tasks completed;
- offline cached view;
- failed daily-plan generation;
- no reviewed verse available;
- timezone transition;
- migrated legacy user;
- account restricted.

## 9.4 Daily goal

Goal progress comes from authoritative completion events. Avoid deceptive progress based on opening a screen or answering without completion policy.

---

## 10. Learning hub

## 10.1 Content model

Display:

- active plan;
- available reviewed plans;
- topic/objective browse;
- search;
- progress summaries;
- prerequisites/locked states when approved;
- resume points.

## 10.2 Search

Search operates on published indexed content. It must support Ukrainian text, common spelling variants where possible and bounded result sets.

Do not load all multi-megabyte question JSON merely to search client-side.

## 10.3 Filters

Filters such as Old Testament/New Testament are content metadata, not inferred from display strings. Selection is URL/query-state compatible for deep linking.

## 10.4 Learning-path card

A card includes:

- title;
- approved description;
- objective/module count;
- progress;
- recommended/resume reason;
- optional restrained imagery;
- clear CTA.

Progress is not calculated from the number of route visits.

---

## 11. Plan, module and lesson flows

## 11.1 Plan

Plan page shows:

- purpose/outcomes;
- modules;
- completion/mastery distinction;
- active module;
- review expectations;
- progress;
- estimated effort only when evidence-based;
- content/version state.

## 11.2 Module

Module shows:

- sequence;
- prerequisite states;
- lesson completion;
- review availability;
- module summary/checkpoint.

Unlocking rules are server-driven.

## 11.3 Lesson blocks

Supported typed blocks:

- heading/text;
- Scripture reference/quotation;
- explanation;
- glossary/term;
- image/illustration with alt/fallback;
- reflection prompt;
- question/practice;
- summary;
- next step.

Each block has schema/version and editorial status. Rendering unknown block types must fail safely with logging rather than crashing the lesson.

## 11.4 Lesson session

Server tracks:

- session ID;
- content revision;
- start time;
- completed blocks or checkpoint;
- completion event;
- idempotency;
- abandoned/resume state.

Client can cache progress optimistically for UX, but authoritative completion comes from the server.

## 11.5 Scripture presentation

- reference and translation visible;
- quotation distinguishes exact text vs paraphrase;
- no typewriter effect;
- no decorative motion that impairs reading;
- copy/share follows rights/product policy;
- translation change does not mutate historical content evidence silently.

---

## 12. Practice and review

## 12.1 Session creation

Client requests a session by intent:

```text
objective/topic
mode: practice | review | mistakes
preferred difficulty if allowed
question count
```

Server returns:

- session ID;
- selected question IDs/revisions;
- presentation-safe question data;
- rules;
- expiry;
- current index;
- no answer key for future questions.

## 12.2 Answer submission

The client sends:

- session ID;
- question ID/revision;
- chosen option/typed answer;
- idempotency key;
- optional timing metadata not trusted for scoring without server reconciliation.

Server returns:

- correctness;
- correct answer after submission;
- explanation;
- Scripture reference;
- learning feedback;
- authoritative session state;
- progression delta when policy grants it;
- event ID.

## 12.3 Correct feedback

- selected answer success state;
- concise `Правильно!`;
- explanation/reference;
- reward is secondary;
- no routine fullscreen confetti;
- CTA remains under user control unless auto-advance is explicitly enabled.

## 12.4 Wrong feedback

- selected wrong answer clearly marked;
- correct answer revealed;
- calm non-shaming language;
- explanation/reference;
- option to review context;
- wrong state is not conveyed by color alone.

## 12.5 Review scheduler

Phase 3 consumes the scheduler contract from Learning domain. The UI displays:

- due count;
- why an item is due in understandable terms;
- review session progress;
- next review estimate only if reliable;
- no fake scientific precision.

## 12.6 Mistake queue

Mistakes are linked to objectives and revisions. If content is corrected, historical attempts remain traceable to the old revision while new review uses the approved current revision according to policy.

---

## 13. Progress model and screen

Distinguish:

- completion: user finished a lesson/session;
- mastery: evidence over objectives;
- review health: due/recent performance;
- streak: consistent qualifying activity;
- XP/level/rank: motivational layer;
- achievements: server-granted milestones.

Progress screen sections:

1. current learning path;
2. objective/module progress;
3. review health;
4. streak/history;
5. level/rank summary;
6. achievements;
7. recent authoritative events.

Avoid four large vanity numbers with no learning meaning.

### Level and rank

Level and rank transitions use server outcomes. A user opening the screen later should not replay an old promotion; consumed event state or event history determines whether celebration is new.

---

## 14. Profile and settings

## 14.1 Profile

- avatar/name;
- role/title/rank as secondary;
- active theme;
- communities entry;
- account status;
- privacy/data controls;
- shop/theme entry if approved.

## 14.2 Settings groups

- Account;
- Bible translation;
- Language/locale;
- Timezone;
- Notifications where supported;
- Theme;
- Motion intensity;
- Haptics;
- Text size/accessibility options where implemented;
- Privacy;
- Data export/delete;
- Logout/session reset where meaningful.

## 14.3 Preference updates

Use bounded preference endpoints. Theme/avatar changes require valid entitlements. Accessibility settings must apply before or during startup to avoid flashing or unwanted motion.

---

## 15. Existing game modes integration

## 15.1 Play Hub

Each mode card states:

- purpose;
- solo/group;
- duration/question count if fixed;
- reward policy;
- whether it affects mastery;
- availability/offline status.

## 15.2 Millionaire

Phase 3 provides shared shell, typography, answer states, ladder components and base motion. Authoritative run/reward logic must come from server services. Full economy/competitive expansion waits for later phases as defined.

## 15.3 Survival

Migrate UI to shared tokens and outcome contracts. Do not preserve client-submitted final score as authority.

## 15.4 Kahoot

Phase 3 may style existing lobby/room/display components and provide motion primitives. Full secure multiplayer persistence, challenge integration, reconnect and production leaderboards belong to Phase 5.

## 15.5 Social/shop previews

Secondary screens may receive the shared design shell, loading/error states and route structure. Do not create fake purchases, fake community activity or demo leaderboards for visual completeness.

---

## 16. Data-fetching and caching

Use React Query or the chosen Phase 2 client for server state.

Rules:

- route-level queries have stable keys;
- abort on route change;
- immutable published content can be cached by version;
- progress/profile invalidation follows authoritative outcomes;
- no duplicated profile in Context + Zustand + localStorage + Query as equal truths;
- stale data displays a sync indicator when necessary;
- offline state is honest;
- mutations use idempotency keys and do not blindly retry.

---

## 17. Accessibility

Required across all core screens:

- semantic headings;
- focus moves to screen/question/dialog heading;
- 44×44 CSS px touch targets;
- visible focus;
- text scaling to 200%;
- screen reader labels;
- correct/wrong not color-only;
- reduced/minimal motion;
- sufficient contrast, especially gold on ivory;
- keyboard operation in browser fallback;
- no hidden exiting element remains clickable;
- ARIA live messages are concise and deduplicated.

---

## 18. Performance

Phase 3 performance constraints:

- do not bundle/load full question banks for core routes;
- code split major routes;
- reserve image dimensions;
- compress hero imagery;
- lazy-load below fold;
- optimize fonts/subsets and avoid layout shifts;
- minimize React provider re-renders;
- avoid animating large layout containers;
- keep initial Today usable on realistic mobile networks;
- test Telegram Android and iOS memory behavior.

Phase 7 performs final hardening, but Phase 3 must not intentionally create known architectural performance debt.

---

## 19. Analytics and privacy

Track product improvement events:

- Today viewed/action selected;
- lesson started/resumed/completed;
- practice/review started/completed;
- answer submitted result category without unnecessary sensitive text;
- redirect usage;
- theme applied;
- accessibility/motion mode usage aggregated;
- errors and abandoned flows.

Do not track private reflections or raw Scripture-related personal notes unless a clear feature/privacy policy exists.

---

## 20. Feature flags and rollout

Suggested flags:

- `learningShellV2`;
- `todayV1`;
- `lessonRendererV1`;
- `practiceSessionV2`;
- `progressViewV2`;
- `rebrandThemeV2`;
- `lightThemeDefault`;
- `motionSystemV2`;
- `profileSettingsV2`.

Rollout:

1. internal component fixtures;
2. design/motion review;
3. route shell behind flag;
4. internal users with migrated data;
5. closed alpha;
6. new users first if migration risk is high;
7. percentage rollout;
8. full rollout after completion/error/performance evidence;
9. remove old shell after compatibility window.

---

## 21. Migration strategy

### Navigation

- add new routes;
- preserve old routes with mapping;
- migrate internal links;
- monitor redirects;
- remove legacy only after evidence.

### Theme

- add semantic tokens and aliases;
- create `light` theme;
- migrate shared components;
- migrate screens;
- audit existing themes;
- deprecate old raw tokens only after coverage.

### Profile/settings

- read Phase 2 projection;
- migrate local-only preferences;
- server-confirm theme/avatar;
- preserve legacy choices;
- store motion/accessibility preference.

### Learning content

- map existing themes/questions to objectives;
- quarantine unmapped/unreviewed content;
- do not fabricate lesson structure from file names alone;
- maintain legacy game access only where content remains valid.

---

## 22. Conflicts with other phases

### Phase 1/2 security and authority

No UI convenience may reintroduce whole-profile writes, client scoring or payload identity.

### Phase 4 content

Phase 3 uses only published/reviewed content contracts. It may temporarily display legacy-unreviewed content only behind an explicit development or migration policy, never as silently approved lessons.

### Phase 5 social

Communities and Kahoot can receive visual integration, but real social data, privacy, moderation and authoritative multiplayer completion belong to Phase 5.

### Phase 6 shop

Theme selection for owned themes is Phase 3. Catalog prices, wallet purchases and monetization are Phase 6. Do not implement fake local purchases.

### Phase 7 offline

Build cache-friendly contracts and honest offline states now, but do not promise unsupported offline completion/reward reconciliation.

### Design reference conflict

Reference screenshots define visual feeling, not exact nav, data or buttons. Product IA and current code migration rules win.

---

## 23. Required tests

### Unit/component

- semantic token/theme mapping;
- invalid theme fallback;
- route metadata/tab mapping;
- lesson block rendering including unknown block;
- AnswerOption states;
- progress/number event deduplication;
- reduced motion;
- theme entitlement selection;
- redirect mapping.

### Integration

- Today with real server data;
- lesson start/resume/complete;
- practice create/answer/complete;
- correct/wrong explanation;
- progress refresh after outcome;
- theme restore across login/device;
- legacy route redirect;
- offline/error/retry states;
- old client compatibility where required.

### E2E/manual

- first-time user;
- returning user;
- migrated legacy theme/profile;
- 320/360/390/430 px widths;
- Android Telegram;
- iOS Telegram;
- browser fallback;
- large text;
- reduced/minimal motion;
- slow network;
- missing imagery;
- dark legacy theme;
- interrupted quiz route;
- no duplicate level-up after reload.

### Visual regression

At minimum:

- Today;
- Learning hub;
- Lesson;
- Quiz idle/correct/wrong;
- result;
- Progress;
- Profile/Settings;
- theme preview;
- Millionaire base screen;
- Kahoot lobby/question/result;
- loading/error/offline;
- full/reduced motion final states.

---

## 24. Forbidden shortcuts

- copying screenshots one-to-one without product data/route review;
- hardcoding `#132F57` and gold throughout components;
- changing rewards while redesigning UI;
- rebuilding progression in React state;
- marking a lesson complete on scroll alone;
- loading every question file on startup;
- adding confetti to every correct answer;
- making the Shop a primary tab solely because legacy layout did;
- removing legacy routes without redirects;
- replacing all components in one unreviewable PR;
- using AI-generated Scripture imagery without editorial policy;
- declaring Phase 3 complete with mock Today or fake progress.

---

## 25. Definition of Done

Phase 3 is complete when:

1. The learning-first app shell is active and rollback-tested.
2. Today uses real server-backed plan/progress data.
3. Learn supports plans, modules, lessons and objectives.
4. Lesson sessions resume and complete authoritatively.
5. Practice/review uses server sessions and explanations.
6. Correct/wrong states are accessible and use shared motion.
7. Progress distinguishes completion, mastery, review, streak and motivational rank.
8. Profile/settings use bounded server preferences.
9. `Світло` is the default free theme for new/invalid profiles.
10. Existing valid theme choices and entitlements are preserved.
11. Shared semantic tokens/components cover all core screens.
12. Motion system supports full/reduced/minimal modes and authoritative event deduplication.
13. Legacy routes redirect intentionally and are measured.
14. Core flows work at mobile widths and in Telegram Android/iOS.
15. No critical accessibility issue remains.
16. Core visual regression and E2E suites pass.
17. UI does not restore client-authoritative rewards or fake social/shop behavior.
18. Documentation and component contracts are synchronized.
19. Product owner approves final visual and learning-flow review.

---

## 26. Rollback

Rollback must:

- restore the old shell/route entry behind a flag;
- preserve new server progress and settings;
- preserve theme choice and entitlements;
- keep new routes available for already issued deep links where possible;
- not revert to insecure Phase 1 behavior;
- not discard lesson/practice outcomes;
- retain semantic token compatibility aliases during the rollout window.

---

## 27. Handoff to Phase 4

Phase 4 receives:

- canonical lesson/question rendering;
- objective-based content queries;
- published revision/version awareness;
- visible explanations and references;
- content error-reporting entry;
- protected admin route boundary;
- shared design/motion components suitable for Content Studio;
- analytics showing content quality failures and empty pools.

Phase 4 then replaces legacy content mutation and AI scripts with a reviewed staging/publication platform without rebuilding the user learning UI.
