# Phase 3.5 — Design v2 Visual Migration (Hallow-Style Rebrand)

> **Priority:** P1 — blocks nothing functionally, but is the approved visual
> baseline everything after it should be built against.  
> **Depends on:** Phase 3 (learning-first shell, design tokens, motion
> system, all merged to `main`).  
> **Sits between:** [`PHASE_3_LEARNING_PRODUCT_REBRAND_AND_MOTION.md`](PHASE_3_LEARNING_PRODUCT_REBRAND_AND_MOTION.md)
> and [`PHASE_4_CONTENT_AI_AND_CONTENT_STUDIO.md`](PHASE_4_CONTENT_AI_AND_CONTENT_STUDIO.md).  
> **Canonical parent:** [`../BIBLE_GAMES_MASTER_SPECIFICATION.md`](../BIBLE_GAMES_MASTER_SPECIFICATION.md)  
> **Design/IA reference:** the `proto/design-v2` branch's `/proto` click-through
> prototype (`src/proto/README.md`) and its screens under `src/proto/screens/`.  
> **Not in the master specification's original Phase 0–8 numbering** — this is
> an owner-approved interstitial phase (approved 2026-09-21) inserted after
> the fact, once the `proto/design-v2` direction was chosen and confirmed as
> final for production. It does not renumber or reorder Phase 4–8; it is a
> scoped addition, tracked the same way as any other phase file per
> [`README.md`](README.md)'s rules.

---

## 1. Product outcome

`proto/design-v2` (chosen 2026-09-17, confirmed as the final production
direction 2026-09-21) replaces `DESIGN_RULES.md`'s current identity —
`Світло` / premium spiritual minimalism — with a new one, evaluated against
Hallow, Glorify and YouVersion: **spiritual premium**. Dark by default, glass
cards, an indigo/violet primary with warm gold reserved for accents, Manrope
for UI text and Literata for headings and Scripture.

After this phase, every screen a user already reaches through Phase 3's
shipped IA (Today/Навчання/Гра/Прогрес/Профіль and their secondary routes)
renders in this system in production — not behind a side route, not as an
opt-in theme choice. The prototype at `/proto` is retired once its tokens and
screens are the real thing; it does not persist as a permanent second
surface (unlike `/proto/studio`, which *is* the permanent implementation
path for Content Studio per Phase 4 §10).

This phase changes **how things look**, not what they do. Phase 3's
information architecture, route model, reward math, and server contracts are
correct and stay exactly as shipped — see §3.

---

## 2. Current baseline and what changes

Phase 3 (WS3, ADR-009) already ships a real semantic-token design system:
`deriveSemanticPalette()` computes ~40 CSS custom properties from each
`CosmeticTheme`'s 5-color `preview`, `src/components/ui/*` is a ~24-component
shared library built on those tokens, and `light` ("Світло") is the current
default free theme. This machinery is *reused*, not replaced:

- **Reused as-is:** the `CosmeticTheme` → `deriveSemanticPalette()` →
  CSS-custom-property pipeline, the theme-switching/persistence mechanism
  (`usePreferences`, `applyCosmeticTheme()`), `src/components/ui/*`'s
  component contracts (props, states), `MotionProvider`/
  `useMotionCapabilities` (§4).
- **Replaced:** the *values* — palette, radii, surface treatment, and the
  `Світло` positioning as the default identity. The new palette becomes
  either the new default `CosmeticTheme` or a straight replacement of the
  existing token values, per the decision in §5.
- **Not reused, must not ship to production as-is:** `/proto`'s isolation
  implementation. `src/proto/proto.css` deliberately runs in its own
  cascade layer, skips Tailwind preflight, and is scoped under
  `.proto-root` so the prototype cannot leak into legacy screens
  (`src/proto/README.md`, "Ізоляція від чинного застосунку") — that
  isolation was a prototyping safety measure, not an architecture to keep.
  Production work re-implements the same visual decisions inside the real
  `src/index.css` / `cosmeticTheme.ts` pipeline Phase 3 already built.

**New dependency decision required before implementation:** the prototype
uses Tailwind v4 + framer-motion + lucide (`src/proto/README.md`'s decisions
table); the shipped app does not currently depend on any of the three. Adopt
them project-wide, or reproduce the same visual/motion result with the
existing stack (plain CSS tokens + the existing `MotionProvider`/
`MotionSheet` primitives)? This needs an ADR before WS1 (§6) starts — it is
not a detail to decide mid-implementation, since it determines bundle-size
budget (WS10 §18 precedent) and whether `MOTION_SYSTEM.md` needs new
primitives or just new timing/easing values.

---

## 3. Explicitly out of scope

Per the "changes how things look, not what they do" framing in §1:

- route model / bottom-tab structure — `/proto`'s five tabs (Сьогодні ·
  Навчання · Грати · Прогрес · Я) already match Phase 3 WS5's shipped IA
  (Today/Навчання/Гра/Прогрес/Профіль) exactly; no route migration needed;
- reward math, progression, entitlements — untouched;
- server contracts, API shapes — untouched;
- content lifecycle — Phase 4's job, not this phase's;
- Content Studio's own screens — already specified against these same
  tokens in Phase 4 §10/§15; this phase does not duplicate that work, it
  makes the *source* tokens Studio already assumes real in production (§7).

---

## 4. Locked visual decisions

From `src/proto/README.md`'s decision table and the two post-review rule
sets (`src/proto/README.md` + [[design-v2-prototype]] memory), owner-approved
and not open for re-litigation during implementation:

- theme: dark by default, light available, switch lives in Profile (not a
  system-only toggle — Phase 3's existing manual override stays);
- palette: indigo/violet primary, warm gold as accent only — never a second
  primary;
- typography: Manrope for UI, Literata for headings and Scripture quotation;
- gamification: balanced — streak/progress stay visible, coins/badges stay
  secondary, never foreground;
- **one primary button per screen** — indigo→violet gradient, inverts to a
  white `onColor` variant when placed on a colored surface;
- the screen's main object (Урок дня / Гра тижня / final overlays) is a
  full-bleed colored card, not a bordered tile;
- progress-ramp gradients end in gold **only in the dark theme**
  (`--p-ramp-end`) — the light theme's ramp does not get the gold endpoint;
- final/result screens do not scroll — sized from viewport height, not
  content height;
- motion: medium intensity (spring transitions, micro-interactions),
  `prefers-reduced-motion` respected — consistent with, not a replacement
  for, Phase 3 WS4's `MotionProvider` intensity levels.

A change to any of these is a new owner decision, not an implementation
judgment call — flag it the same way Phase 3 WS5/WS6/WS8 locked scope
decisions via `AskUserQuestion` before building rather than assuming.

---

## 5. Migration approach

Mirrors Phase 3's own dual-render pattern (`learningShellV2` et al.) rather
than inventing a new one:

1. Land the new palette as computed `deriveSemanticPalette()` output —
   either a new `CosmeticTheme` entry evaluated behind a flag (e.g.
   `designSystemV2`) that becomes the new `DEFAULT_COSMETIC_THEME_ID` at
   full rollout, or a direct edit of the existing token *values* if the
   owner decides there is no value in keeping the old palette selectable
   at all post-migration. This is a real decision (keep old `Світло`/
   `classic` as legacy-selectable themes, like `classic` survived WS3/WS8,
   or retire them) — do not assume either answer.
2. Re-skin screens incrementally behind the flag, reusing
   `src/components/ui/*` component contracts where the visual change is
   token-only (color/radius/surface), and extending or replacing a
   component where the prototype's interaction model actually differs
   (e.g. the full-bleed hero-card pattern, §4).
3. Re-run the WS10 §17 accessibility audit (contrast, touch targets,
   focus-visible, text scaling, ARIA live) against the new palette — a
   palette change invalidates a prior contrast pass, it does not carry
   over.
4. Re-run the WS10 §18 performance budget gate if Tailwind v4/framer-motion
   are adopted (§2) — new dependencies change the bundle-boundary numbers
   that gate was built to catch.
5. No visual regression suite exists in this repo (Phase 3's own
   handoff note, `PHASE_3_TO_4_HANDOFF.md`) — still true, still not this
   phase's to invent unless the owner explicitly asks for one now that a
   full repaint makes the gap more costly to skip.
6. Flip default, verify rollback (flag off renders the exact pre-migration
   screens), retire `/proto` as a route once parity is confirmed.

---

## 6. Suggested workstreams

1. **WS1 — Palette/token foundation.** ADR on the Tailwind v4/framer-motion/
   lucide dependency question (§2). New `deriveSemanticPalette()` input
   values (or new `CosmeticTheme`) matching §4's locked palette. No screen
   changes yet.
2. **WS2 — Core navigation shell.** Bottom nav, `AppShellV2` container,
   aurora/gradient background treatment, theme switch relocation/behavior
   in Profile.
3. **WS3 — Today + Learn.** Hero card pattern, lesson/module/plan screens.
4. **WS4 — Practice/Review + Play hub.** Note WS9 (Phase 3) already
   reskinned Millionaire/Survival/Kahoot once against the *old* token
   system with real score-authority fixes — this pass is tokens/surfaces
   only, must not re-touch the reward/authority logic WS9 already fixed.
5. **WS5 — Progress + Profile/Settings/Themes.**
6. **WS6 — Shop/Social secondary routes.**
7. **WS7 — Accessibility + performance re-audit, flag flip, rollback
   verification, `/proto` retirement.**
8. **WS8 — Post-flip visual audit follow-up** (added after WS7 closed the
   phase; not in the original plan). Closes coverage gaps a full-screen
   sweep found after the flag flip: `Today`/`PlayHub`/`LessonSession`/
   `ProfileV2`/`Shop`/`Communities`/`Challenges` all still had `designSystemV2`
   surfaces that hadn't received the hero-card/`CoverArt` treatment the rest
   of the phase established. All additions remain gated behind
   `designSystemV2` per the phase's own rollback contract (§11.4).

Sequencing is a recommendation, not a contract — same caveat every other
phase doc in this repo carries (`README.md`'s "план не виконується сліпо").

---

## 7. Content Studio consistency

Phase 4 §10/§15 already specifies Content Studio against the *same* token
family (`--p-*`), just denser (14px base, 12/8 radii, opaque panels, static
tint instead of moving aurora — `src/proto/studio/README.md`, "Чому «та сама
мова, але щільніше»"). That was written before this phase's tokens existed
in production. Once WS1 (§6) lands real values, Content Studio's
implementation should import from the same source of truth Phase 4 builds
against — not fork a second copy of the palette. This phase does not block
Phase 4/Content Studio work from starting; Studio is already a separate
bundle (Phase 4 §10.1) and can be built against the prototype's token values
directly if Studio implementation starts before this phase finishes, then
re-pointed at the production tokens once WS1 lands.

---

## 8. Documentation deliverables

- **`docs/DESIGN_RULES.md` rewritten**, not amended — the document currently
  states it replaces the pre-Phase-3 "Dark luxury / parchment gold"
  direction; it needs the equivalent rewrite for design-v2, including a new
  canonical theme name/identity, updated tokens, typography, surfaces, and
  the locked rules in §4 above. Do this as a deliberate rewrite pass, not a
  patch — the current document's structure (§1 role, semantic tokens,
  typography, spacing, surfaces, component patterns, illustration rules,
  game-mode exceptions, accessibility, theme architecture, visual QA) is a
  reasonable shape to keep.
- **`docs/MOTION_SYSTEM.md`** — update only if §2's dependency ADR changes
  the underlying motion primitives; otherwise the existing contract (full/
  reduced/minimal intensity, authoritative event dedup) already applies.
- **`docs/PHASE_STATUS.md`** — add a row for this phase (done alongside this
  document).
- **`docs/phases/README.md`** — add this file to the plan index (done
  alongside this document).

---

## 9. Conflicts and interactions

### Phase 4 content/Content Studio

Not blocked in either direction (§7). Phase 4's content lifecycle work does
not depend on this phase's screens; this phase's screens do not depend on
Phase 4's content existing (Today/Learn already render correct empty states
per `PHASE_3_TO_4_HANDOFF.md`).

### Phase 5/6/7

No functional change to social, shop/monetization or offline behavior —
purely visual. Shop/Social re-skin (§6 WS6) must not add fake purchases or
change entitlement logic, same forbidden-shortcut as Phase 3 §24.

### Design reference conflict

Same rule as Phase 3 §22: the prototype defines visual feeling and the
locked decisions in §4, not an exact pixel copy where product data,
accessibility, or Telegram platform constraints require a difference.

---

## 10. Forbidden shortcuts

- shipping `/proto`'s isolated cascade-layer implementation into production
  instead of integrating with `deriveSemanticPalette()`/`cosmeticTheme.ts`;
- skipping the WS10 §17 accessibility re-audit because "it already passed
  once" — that pass was against the old palette;
- changing reward math, route IA, or server contracts while re-skinning;
- re-touching WS9's score-authority fix in Millionaire/Survival while doing
  the token-only re-skin (§6 WS4);
- silently dropping `classic`/legacy themes without an explicit owner
  decision to retire them (§5 step 1);
- declaring this phase done with only some screens migrated and the rest
  silently left on the old palette.

---

## 11. Definition of Done

This phase is complete when:

1. The §2 dependency ADR is written and decided (adopt Tailwind v4/
   framer-motion/lucide, or reproduce the same result in the existing
   stack).
2. `deriveSemanticPalette()` (or its replacement) produces the §4 palette
   in production, not just in `/proto`.
3. Every screen reachable through Phase 3's shipped bottom-tab IA renders
   in the new system — no screen silently left on the old palette.
4. The §5 rollout flag flips to full default and rollback is verified live
   (flag off restores the pre-migration screens exactly, same verification
   pattern as Phase 3 WS10 §20).
5. WS10 §17's accessibility audit (contrast, touch targets, focus-visible,
   text scaling, ARIA live) is re-run and passes against the new palette.
6. WS10 §18's performance budget gate is re-run and passes, accounting for
   any new dependencies from the §2 ADR.
7. `docs/DESIGN_RULES.md` is rewritten to describe the new system as
   canonical; `docs/PHASE_STATUS.md` and `docs/phases/README.md` reflect
   this phase as complete.
8. `/proto` is retired as a route (its job is done — the real screens are
   the prototype now).
9. Content Studio (Phase 4) is confirmed to consume the same production
   token source, not a forked copy.
10. Product owner approves the final visual review, same non-agent-
    completable gate as Phase 3 §25.19.

---

## 12. Rollback

- Flip the rollout flag off (§5) — restores the exact pre-migration screens,
  the same mechanism Phase 3 built and verified for its own rollout.
- `classic`/legacy `CosmeticTheme` entries, if kept selectable (§5 step 1),
  remain a manual per-user fallback independent of the flag.
- No data migration is involved — this is a pure presentation-layer change,
  so rollback carries no data-consistency risk the way a schema migration
  would.

---

## 13. Handoff to Phase 4

Phase 4 receives, in addition to everything `PHASE_3_TO_4_HANDOFF.md`
already lists:

- a production token source (`deriveSemanticPalette()` output under the new
  palette) that Content Studio's implementation should consume directly
  instead of hand-copying prototype values;
- confirmation that Content Studio's visual/IA reference (Phase 4 §10's
  `/proto/studio` pointer) is built on the same design language the rest of
  the product now actually ships, not a speculative direction that might
  still change.
