import { motion, useReducedMotion } from 'framer-motion';
import { fadeOnlyVariants, reducedTransition, transitionUi } from '../lib/motion';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  count?: number;
  gap?: string | number;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 'var(--radius-sm)', count = 1, gap = '0.75rem' }: SkeletonProps) {
  const reduced = useReducedMotion();
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <motion.div
      role="status"
      aria-label="Завантаження"
      initial="initial"
      animate="animate"
      variants={fadeOnlyVariants}
      transition={reducedTransition(transitionUi, !!reduced)}
      style={{ display: 'flex', flexDirection: 'column', gap }}
    >
      {items.map((i) => (
        <div
          key={i}
          style={{
            width: typeof width === 'number' ? `${width}px` : width,
            height: typeof height === 'number' ? `${height}px` : height,
            borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
            background: 'linear-gradient(90deg, var(--surface) 25%, var(--surface-hover) 50%, var(--surface) 75%)',
            backgroundSize: '200% 100%',
            animation: reduced ? 'none' : 'shimmer 1.5s var(--ease-in-out) infinite',
            opacity: 1 - i * 0.08,
          }}
        />
      ))}
    </motion.div>
  );
}

export function CardSkeleton() {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <Skeleton width="60%" height={18} borderRadius="var(--radius-sm)" />
      <Skeleton height={14} borderRadius="var(--radius-sm)" count={2} gap="0.4rem" />
    </div>
  );
}
