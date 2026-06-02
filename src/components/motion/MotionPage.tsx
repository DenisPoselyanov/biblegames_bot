import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { pageVariants, reducedTransition, transitionPage } from '../../lib/motion';

type MotionPageProps = {
  enter?: boolean;
  className?: string;
  children?: ReactNode;
};

export function MotionPage({ children, enter = true, className }: MotionPageProps) {
  const reduced = useReducedMotion();

  if (!enter) {
    return <section className={className}>{children}</section>;
  }

  return (
    <motion.section
      className={className}
      initial={reduced ? { opacity: 0 } : 'initial'}
      animate="animate"
      variants={pageVariants}
      transition={reducedTransition(transitionPage, !!reduced)}
    >
      {children}
    </motion.section>
  );
}
