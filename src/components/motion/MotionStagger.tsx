import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { staggerContainer, staggerItem } from '../../lib/motion';

type StaggerAs = 'ul' | 'ol' | 'div' | 'section';

type MotionStaggerProps = {
  as?: StaggerAs;
  children: ReactNode;
  className?: string;
  /** When false, skip entrance stagger (e.g. revisiting a tab) */
  enter?: boolean;
};

export function MotionStagger({ as = 'ul', children, className, enter = true }: MotionStaggerProps) {
  const reduced = useReducedMotion();

  if (reduced || !enter) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  if (as === 'ul') {
    return (
      <motion.ul className={className} initial="initial" animate="animate" variants={staggerContainer}>
        {children}
      </motion.ul>
    );
  }

  if (as === 'ol') {
    return (
      <motion.ol className={className} initial="initial" animate="animate" variants={staggerContainer}>
        {children}
      </motion.ol>
    );
  }

  if (as === 'section') {
    return (
      <motion.section className={className} initial="initial" animate="animate" variants={staggerContainer}>
        {children}
      </motion.section>
    );
  }

  return (
    <motion.div className={className} initial="initial" animate="animate" variants={staggerContainer}>
      {children}
    </motion.div>
  );
}

type MotionStaggerItemProps = {
  as?: 'li' | 'div';
  children: ReactNode;
  className?: string;
  enter?: boolean;
};

export function MotionStaggerItem({ as = 'li', children, className, enter = true }: MotionStaggerItemProps) {
  const reduced = useReducedMotion();

  if (reduced || !enter) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  if (as === 'li') {
    return (
      <motion.li className={className} variants={staggerItem}>
        {children}
      </motion.li>
    );
  }

  return (
    <motion.div className={className} variants={staggerItem}>
      {children}
    </motion.div>
  );
}

type MotionFadeProps = {
  children: ReactNode;
  className?: string;
};

export function MotionFade({ children, className }: MotionFadeProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {children}
    </motion.div>
  );
}
