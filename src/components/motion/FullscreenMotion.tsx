import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { pageVariants, reducedTransition, transitionPage } from '../../lib/motion';

interface FullscreenMotionProps {
  motionKey: string;
  children: ReactNode;
  className?: string;
  enter?: boolean;
}

/** Page enter for routes outside Layout (quiz, survival, etc.) */
export function FullscreenMotion({ motionKey, children, className, enter = true }: FullscreenMotionProps) {
  const reduced = useReducedMotion();

  if (!enter || reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={motionKey}
        className={className}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageVariants}
        transition={reducedTransition(transitionPage, !!reduced)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
