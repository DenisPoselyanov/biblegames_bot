# Bible Games — Phase 3 rollout & rollback runbook

Phase 3 §20/§26, made concrete for the flags Phase 3 actually ships. All eight
are **client-side, build-time** (`VITE_FLAG_*`, see `src/lib/flags.ts`) — there
is no server-side or runtime toggle. Per [DEPLOYMENT.md](DEPLOYMENT.md) §3.1,
`VITE_*` is inlined into `dist/` at build time; flipping any of these flags
means rebuilding and redeploying the static frontend bundle (an atomic
`dist/` swap, not a partial/gradual rollout mechanism).

---

## 1. Flags

| Flag | Values | Default (2026-09-21) | Gates |
|------|--------|----|-------|
| `learningShellV2` | `false` \| `true` | **`true`** | Master switch: the entire v2 route tree (`AppShellV2`, bottom nav, all routes below) vs. the legacy `Layout`/`Home` tree. |
| `today_dashboard` | `false` \| `true` | **`true`** | Index route renders `Today` (WS6) instead of legacy `Home`. |
| `learning_plans` | `false` \| `true` | **`true`** | `/learn` renders `LearningHub` (WS6) instead of `StudyHub`. |
| `lesson_experience_v2` | `false` \| `true` | **`true`** | `/learn/plans/:id`, `.../modules/:id`, `/learn/lessons/:id` render real screens instead of `ComingSoon`. |
| `practiceSessionV2` | `false` \| `true` | **`true`** | `/practice`, `/practice/session/:id`, `/review` render real screens (WS7) instead of `ComingSoon`. Single gate for all three — Review launches a Practice session, so they ship/flip atomically. |
| `progress_dashboard_v2` | `false` \| `true` | **`true`** | `/progress` renders `ProgressV2` (WS7) instead of legacy `ProgressDashboard`. |
| `profileSettingsV2` | `false` \| `true` | **`true`** | `/profile`, `/profile/settings`, `/profile/themes` render `ProfileV2`/`Settings`/`ThemePicker` (WS8) instead of legacy `Profile` / `ComingSoon`. |
| `lightThemeDefault` | `false` \| `true` | **`true`** | `Світло` (light) is the default free theme for new/invalid profiles (ADR-009). Existing users' saved theme choice is unaffected regardless of this flag — it only changes the fallback for profiles with no stored choice. |

Three additional registered flags exist but are **dead** once the six above
are on, because they only gate sections of the now-unreachable legacy
`Layout`/`Home` tree: `learning_first_navigation`, `daily_plan_v2`,
`review_scheduler_v2`. They stay at their original `false` default —
flipping them has no observable effect while `learningShellV2=true`, and
leaving them off keeps the rollback surface (§3) minimal.

---

## 2. Rollout status

**Decision (2026-09-21, product owner):** the master spec's §20 staged sequence
(fixtures → design review → shell-behind-flag → migrated internal users →
alpha → new-users-first → percentage → full → remove old shell after window)
describes a live, gradual, production-traffic-driven rollout that requires
production metrics/ops access this repository's agent does not have. In its
place, the decision was made to flip every flag above to its **full-rollout
default in code**, verified locally (build/typecheck/full test suite green,
live dev-server QA — see below), and treat the actual staged exposure to real
traffic as an operational step the team runs at deploy time using this
runbook, not as an in-repo agent task.

The legacy `Layout`/`Home`/`ThemeDetail`/`Profile` route tree is **not**
deleted — §20's "remove old shell after window" and §26's "retain semantic
token compatibility aliases during the rollout window" steps are intentionally
deferred until the team has run its own retention window against real traffic.

### 2.1 What was verified before flipping the defaults

- `tsc -b` (client) and `tsc -p server/tsconfig.json` both clean.
- Full suite: 453/453 (`npx vitest run`) — includes the two new §23 unit-test
  gaps this close-out closed (`eventDedup.test.ts`,
  `motionCapabilities.test.ts`, see the plan doc's WS10 §23 entry).
- Live dev-server QA (no `.env.local` overrides, i.e. exercising the new code
  defaults exactly as a production build would):
  - Fresh load renders `Today` inside the v2 shell with the `light` theme
    applied (ivory background, 5-tab nav) — confirms `learningShellV2` +
    `today_dashboard` + `lightThemeDefault` all take effect from the code
    default alone.
  - `/play/millionaire` (a route always reachable regardless of these flags)
    renders correctly with the WS10 §17 gold-on-ivory contrast fix visible —
    confirms the flag flip didn't regress an already-reachable screen.
  - Rollback path (§3 below) exercised: `VITE_FLAG_LEARNINGSHELLV2=false` +
    `VITE_FLAG_LIGHTTHEMEDEFAULT=false`, dev server restarted (Vite bakes
    `VITE_*` at server start, not hot-reloaded) → the legacy 4-tab
    `Layout`/`PlayHub` shell renders correctly. (The previously-selected
    `light` theme persisted across the flip, which is correct,
    by-design behavior — WS8's "existing user choice remains" — not a bug.)

### 2.2 Known gap this rollout inherits (not new, not fixed here)

**No learning content is `published`.** WS1's mapping script lands everything
as `legacy_unreviewed`; WS2's read API only serves `published` rows by design
(§21 "quarantine unmapped/unreviewed content"). This means `Today`, Learn
(plans/modules/lessons) and Practice/Review will render real, correct **empty
states** in production until Phase 4 ships a publication step — not a bug in
this flip, but the reason Phase 4's content-authoring pipeline is the
immediate next priority after this rollout, not a nice-to-have.

---

## 3. Rollback

Per §26's requirements, rollback here means: **rebuild the frontend with the
flags above reverted, redeploy** (atomic `dist/` swap). Concretely, either:

- revert `FLAG_DEFAULTS` in `src/lib/flags.ts` to `false` for the affected
  flag(s) and redeploy, or
- keep the code default and set the corresponding `VITE_FLAG_<NAME>=false`
  in the build environment and redeploy (no code change, useful for a fast
  emergency rollback without waiting on a PR).

Verified true by construction / by the checks in §2.1:

- **Restores the old shell/route entry** — `learningShellV2=false` alone is
  sufficient; the legacy `Layout` tree is untouched code, not deleted.
- **Preserves new server progress and settings** — lesson/practice/review
  sessions, `progression_state`, `entitlements` and preferences all live in
  Phase 2's typed tables server-side; nothing about this client-only flag
  flip touches them. Rolling the shell back does not roll back or hide
  server-recorded progress — a user who completed lessons under the v2 shell
  keeps that progress; the legacy `ProgressDashboard`/`Profile` screens read
  the same `readProfile()` overlay WS7/WS8 already do.
- **Preserves theme choice and entitlements** — `lightThemeDefault` only
  changes the *fallback* for profiles with no stored `activeTheme`; a
  profile that already has one (set under v2 or before) is read the same way
  regardless of this flag (verified live in §2.1).
- **Keeps new routes available for already-issued deep links** — the v2
  route paths (`/learn/...`, `/practice/...`, `/progress`, `/profile/...`)
  are only registered inside `learningShellV2`'s branch of `App.tsx`'s route
  tree; a full rollback (`learningShellV2=false`) does *not* keep them
  resolvable — this is the one §26 requirement this rollout cannot satisfy
  without also keeping `learningShellV2=true`. If a partial rollback is ever
  needed while `learningShellV2` stays on, each of the other seven flags can
  be reverted independently and its route falls back to the pre-existing
  legacy/`ComingSoon` element instead of 404ing.
- **Does not revert to insecure Phase 1 behavior** — no Phase 1 client-write
  path is touched by any Phase 3 flag.
- **Does not discard lesson/practice outcomes** — see "preserves new server
  progress" above; these are server rows, not client state.
- **Retains semantic token compatibility aliases** — WS3's dual-write
  (`src/index.css` `:root` fallbacks aliasing the new ~40 semantic tokens to
  the classic theme's values) is unconditional, not behind any of these
  flags, so it survives any combination of flag states.

---

## 4. Next steps (owned by the team, not this agent)

1. Deploy with the new defaults; watch route-analytics (`routeAnalytics.ts`,
   §5.3) and the WS10 §19 telemetry events (`today_viewed`, `lesson_started`,
   `practice_session_started`, etc.) for the first real-traffic window.
2. Kick off Phase 4's content-authoring/publication pipeline — until content
   is `published`, the shipped v2 screens are correct but empty (§2.2).
3. After a retention window with no rollback need, delete the legacy
   `Layout`/`Home`/`ThemeDetail`/`Profile.tsx` tree and the three dead flags,
   per §20's final "remove old shell" step and this doc's §2's deferred item.
