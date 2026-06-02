import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import {
  answerCorrectVariants,
  answerWrongVariants,
  DURATION,
  EASE_OUT,
  tapSpring,
} from '../../lib/motion';

export type AnswerOptionVisualState = 'idle' | 'selected' | 'correct' | 'wrong' | 'hidden';

interface AnswerOptionButtonProps {
  children: ReactNode;
  className?: string;
  visualState: AnswerOptionVisualState;
  disabled?: boolean;
  onClick?: () => void;
}

function motionStateFor(visual: AnswerOptionVisualState): 'idle' | 'correct' | 'wrong' {
  if (visual === 'correct') return 'correct';
  if (visual === 'wrong') return 'wrong';
  return 'idle';
}

export function AnswerOptionButton({
  children,
  className,
  visualState,
  disabled,
  onClick,
}: AnswerOptionButtonProps) {
  const reduced = useReducedMotion();
  const isHidden = visualState === 'hidden';
  const motionState = motionStateFor(visualState);
  const variants = reduced
    ? {
        idle: { opacity: 1 },
        correct: {
          opacity: [1, 0.96, 1],
          transition: { duration: DURATION.fast, ease: EASE_OUT },
        },
        wrong: {
          opacity: [1, 0.9, 1],
          transition: { duration: DURATION.fast, ease: EASE_OUT },
        },
      }
    : motionState === 'wrong'
      ? answerWrongVariants
      : answerCorrectVariants;

  return (
    <motion.button
      type="button"
      className={className}
      disabled={disabled || isHidden}
      onClick={onClick}
      variants={variants}
      initial="idle"
      animate={motionState}
      whileTap={!disabled && !isHidden && visualState === 'idle' ? { scale: 0.98 } : undefined}
      transition={reduced ? { duration: DURATION.fast, ease: EASE_OUT } : tapSpring}
      style={{ transformOrigin: 'center center' }}
    >
      {children}
    </motion.button>
  );
}
