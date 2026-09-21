# Phase 3 → Phase 4 handoff

> Written at Phase 3 close-out (2026-09-21), per
> [`PHASE_3_LEARNING_PRODUCT_REBRAND_AND_MOTION.md`](PHASE_3_LEARNING_PRODUCT_REBRAND_AND_MOTION.md)
> §27. Rollout/rollback mechanics are in
> [`ROLLOUT_PHASE_3.md`](../ROLLOUT_PHASE_3.md); workstream-by-workstream
> evidence is in `.claude/plans/phase-3-learning-shell-rebrand.md`.

## What Phase 4 receives

Per §27, in the order the spec lists them:

1. **Canonical lesson/question rendering** — `LessonBlockRenderer.tsx` +
   `lessonBlockPayloads.ts` (WS6): a lookup-table dispatch over one zod schema
   per §11.3 block type (heading, scripture-quote, explanation, glossary,
   image, reflection, question, summary, next-step). An unknown block type or
   an invalid payload logs and falls back safely instead of crashing the
   lesson — Content Studio can ship a new block type without a client crash
   as long as it also ships the fallback path first.
2. **Objective-based content queries** — the `learning` domain (WS1: typed
   `learning_plans` / `learning_modules` / `lessons` / `lesson_blocks` /
   `objectives`, migration `0007_learning_domain`) plus WS2's read API
   (`GET /api/v1/learning/{today,plans,plans/:id,modules/:id,lessons/:id,search}`)
   and WS6/WS7's client hooks (`src/repos/learningRepo.ts`,
   `src/queries/useLearning.ts`). All reads are published-only by construction.
3. **Published revision/version awareness** — every learning row carries a
   `status` (`legacy_unreviewed` / `published`, ADR-004's convention) and the
   read API enforces published-only server-side, not just client-side
   filtering. **This is also Phase 4's first and most urgent job**: WS1's
   mapping script (`scripts/migrate/map-learning-content.ts`) landed 17 plans
   / 108 modules / 460 objectives / 460 lessons, and every single one is still
   `legacy_unreviewed`. With Phase 3's flags now on by default (see
   `ROLLOUT_PHASE_3.md`), Today/Learn/Practice/Review are live and correctly
   showing **empty states** — the UI is not broken, there is simply nothing
   published yet. Phase 4's authoring/review/publish pipeline is what turns
   those empty states into a populated app; until then this is expected, not
   a regression to chase.
4. **Visible explanations and references** — `AnswerFeedback` (WS3/WS7) is
   wired to real per-question explanation text from the pinned question
   revision the practice/review session recorded (`practice_sessions`
   table), not a generic message.
5. **Content error-reporting entry** — `src/lib/errorReporter.ts` (pre-Phase-3,
   extended through WS3–10) is the existing pipe; no new Phase-3-specific
   content-error channel was invented — Phase 4 should route "this question
   is wrong" user reports through it rather than building a parallel path.
6. **Protected admin route boundary** — `/admin` (`AdminPanel.tsx`) sits behind
   the same RBAC/audit middleware from Phase 1 (`server/domains/identity`),
   untouched by Phase 3; Content Studio can extend this boundary rather than
   replace it.
7. **Shared design/motion components suitable for Content Studio** —
   `src/components/ui/*` (WS3: `AppPage`, `PageHeader`, `ContentCard`,
   `ListRow`, `Button`, `BottomSheet`/`Dialog`, etc.) and
   `src/components/motion/*` (WS4: `MotionProvider`/`useMotionCapabilities`,
   `MotionSheet`/`MotionDialog`, `eventDedup`). Both are already used outside
   the pure end-user surface (`AdminPanel` reuses shell/shared components),
   so Content Studio has a working precedent to build from rather than a
   green field.
8. **Analytics showing content quality failures and empty pools** — WS2's
   `404` for "no published questions for this objective" is a real,
   distinguishable response (not a silent empty array), and WS10 §19's
   `TelemetryEventName` allowlist pattern
   (`server/middleware/validateBody.ts`) is the mechanism to add a
   content-quality event through — extend the allowlist rather than
   bypassing it.

## What Phase 4 does *not* need to rebuild

Per §27's closing line — Phase 4 replaces legacy content mutation and the AI
scripts with a reviewed staging/publication platform **without rebuilding the
user learning UI**. Concretely: the five `src/pages/learn/*` screens, the two
`src/pages/practice/*` + `ReviewHub` screens, and `ProgressV2` are the
permanent UI; Phase 4's job is to make the `published` rows they already read
non-empty, plus build the authoring/review workflow that produces those rows
— not to touch the rendering layer itself unless a new §11.3 block type is
introduced.

## Open items Phase 3 is handing off explicitly, not hiding

- **No content is published** (see item 3 above) — the single biggest thing
  standing between this rollout and a populated app.
- **No visual regression suite exists in this repo** (§23's "visual
  regression" required-tests category). Phase 3 could not respect self-set
  expectations set by the master spec on tooling that has never been built —
  a genuinely fresh decision (which tool, which screens, what infra) is
  needed before Phase 4 or a later hardening phase can lean on one. Manual/
  live-browser QA was substituted throughout Phase 3 (documented per-WS in
  the plan doc) and is not a replacement for pixel-diff coverage.
- **No React component-rendering test harness exists** (no
  `@testing-library/react`, no jsdom in `vitest.config.ts`) — component logic
  that needed unit coverage was extracted into plain `.ts` modules where
  possible (`lessonBlockPayloads.ts`, `motionCapabilities.ts` as of this
  close-out); `AnswerOption`'s visual states (§23 "AnswerOption states") are
  the one remaining required-test item with no non-component way to cover it.
- **Telegram Android/iOS on-device verification is not done** — every WS
  through Phase 3 relied on desktop dev-server QA at emulated mobile
  widths (320–430px). Real-device Telegram WebView quirks (memory behavior,
  safe-area insets, back-button interaction) are explicitly deferred to
  Phase 7's hardening pass, per the WS10 §18 performance note already in the
  plan doc.
- **Product-owner sign-off (§25.19) has not happened** — this is, by
  definition, not something an agent can complete on the product owner's
  behalf. Everything else in this document and in `ROLLOUT_PHASE_3.md` is
  written so that review can happen against a concrete, already-deployed-by-
  default state rather than a hypothetical one.
