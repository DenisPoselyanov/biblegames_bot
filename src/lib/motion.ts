import type { Transition, Variants } from 'framer-motion';

/**
 * Canonical motion tokens — docs/MOTION_SYSTEM.md §5 (ADR-010). Single source of
 * truth: components reuse these instead of inventing local durations, easings or
 * distances (§31 agent rule — "create local easing for each component" is forbidden).
 *
 * Also mirrored (where used) as CSS custom properties in `index.css` (`--duration-*`,
 * `--ease-*`) for the handful of places that animate via plain CSS transitions
 * instead of framer-motion.
 */

/** §5.1 duration ladder, in seconds. `normal`/`slow` predate this ladder and stay
 * at their original values (still used by pre-WS4 CSS `--duration-normal`/`-slow`
 * mirrors and existing components) — new code should reach for `standard`/`emphasis`
 * by name instead. */
export const DURATION = {
  instant: 0.08,
  micro: 0.12,
  fast: 0.16,
  /** = `standard` in §5.1's table. */
  normal: 0.24,
  standard: 0.24,
  page: 0.28,
  progress: 0.4,
  /** §5.1 "emphasis" range is 440–600ms; kept distinct from legacy `slow` (440ms,
   * unchanged) so new result/achievement/milestone motion can target the canonical
   * value without touching `slow`'s existing callers. */
  emphasis: 0.52,
  slow: 0.44,
  celebration: 0.9,
  ceremony: 1.4,
} as const;

/** §5.2 travel distances, in px, for slide/offset-style motion. */
export const DISTANCE = {
  xs: 2,
  sm: 6,
  md: 12,
  lg: 20,
  page: 24,
} as const;

/** §5.3 scale presets — `[from, to]` or `[from, mid, to]` sequences. */
export const SCALE = {
  press: [1, 0.975] as const,
  answerSelection: [1, 0.985] as const,
  softEmphasis: [1, 1.015, 1] as const,
  modalEnter: [0.97, 1] as const,
  achievement: [0.82, 1] as const,
  majorReward: [0.72, 1] as const,
};

/** §5.4 "Fast UI" — button, sheet, answer selection, dropdown. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
/** §5.4 "Controlled exit" — shorter than enter; use for exit transitions. */
export const EASE_EXIT = [0.4, 0, 1, 1] as const;
/** §5.4 "Premium smooth" — page enter, progress, card reveal, achievement, result. */
export const EASE_SMOOTH = [0.22, 1, 0.36, 1] as const;
/** Symmetric ease-in-out for shake-style micro-motion; not one of §5.4's three named
 * curves (none of them fit a there-and-back shake), kept as a documented exception. */
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export const STAGGER_DELAY = 0.04;
export const STAGGER_CAP = 6;

/** §5.5 — spring is allowed only for direct press, drag, active tab indicator, small
 * badge reveal; never for Scripture/lesson content, dialogs, error states or purchase
 * confirmation. */
export const tapSpring = { type: 'spring' as const, stiffness: 400, damping: 30 };

export const transitionUi: Transition = {
  duration: DURATION.standard,
  ease: EASE_OUT,
};

export const transitionPage: Transition = {
  duration: DURATION.page,
  ease: EASE_OUT,
};

export function reducedTransition(t: Transition, reduced: boolean): Transition {
  if (!reduced) return t;
  return { duration: 0.08, ease: 'linear' };
}

export function staggerDelay(index: number): number {
  return index < STAGGER_CAP ? index * STAGGER_DELAY : STAGGER_CAP * STAGGER_DELAY;
}

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

/** Tab-level layout: opacity only — avoids jump/glitch between main nav screens */
export const layoutTabVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const transitionLayoutTab: Transition = {
  duration: DURATION.fast,
  ease: EASE_SMOOTH,
};

export const fadeUpVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 6 },
};

export const scaleVariants: Variants = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.985 },
};

export const backdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const sheetVariants: Variants = {
  initial: { opacity: 0, y: '12%' },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: '10%' },
};

export const dialogVariants: Variants = {
  initial: { opacity: 0, scale: 0.97, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.985, y: 6 },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: STAGGER_DELAY,
      delayChildren: 0.02,
    },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

export const questionVariants: Variants = {
  initial: { opacity: 0, x: 10 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8 },
};

export const fadeOnlyVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const answerCorrectVariants: Variants = {
  idle: { scale: 1, y: 0, opacity: 1 },
  correct: {
    scale: [1, 1.015, 1],
    y: [0, -2, 0],
    opacity: [1, 0.98, 1],
    transition: { duration: DURATION.normal, ease: EASE_SMOOTH },
  },
};

export const answerWrongVariants: Variants = {
  idle: { x: 0, scale: 1, opacity: 1 },
  wrong: {
    x: [0, -3, 3, -2, 0],
    scale: [1, 0.997, 1],
    opacity: [1, 0.94, 1],
    transition: { duration: DURATION.fast, ease: EASE_IN_OUT },
  },
};

export const answerFeedbackVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.fast, ease: EASE_SMOOTH } },
  exit: { opacity: 0, y: 4, transition: { duration: DURATION.micro, ease: EASE_OUT } },
};

export const answerRevealFlashVariants: Variants = {
  idle: { opacity: 0 },
  flash: {
    opacity: [0, 0.18, 0],
    transition: { duration: DURATION.page, ease: EASE_OUT },
  },
};
