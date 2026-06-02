import type { Transition, Variants } from 'framer-motion';

/** Mirrors CSS tokens in index.css */
export const DURATION = {
  micro: 0.1,
  fast: 0.16,
  normal: 0.24,
  page: 0.28,
  progress: 0.4,
  slow: 0.44,
} as const;

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
export const EASE_SMOOTH = [0.22, 1, 0.36, 1] as const;

export const STAGGER_DELAY = 0.04;
export const STAGGER_CAP = 6;

export const tapSpring = { type: 'spring' as const, stiffness: 400, damping: 30 };

export const transitionUi: Transition = {
  duration: DURATION.normal,
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
