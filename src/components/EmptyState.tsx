import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { fadeUpVariants, reducedTransition, transitionUi } from '../lib/motion';
import { type IconName, Icon } from './Icon';

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon = 'info', title, description, action }: EmptyStateProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={fadeUpVariants}
      transition={reducedTransition(transitionUi, !!reduced)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1.5rem',
        textAlign: 'center',
        gap: '0.75rem',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 'var(--radius-full)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
        }}
      >
        <Icon name={icon} size={28} />
      </div>
      <h3 style={{ fontSize: 'var(--fs-lg)', color: 'var(--text)', margin: 0 }}>{title}</h3>
      {description && (
        <p style={{ margin: 0, fontSize: 'var(--fs-md)', color: 'var(--text-muted)', maxWidth: 280, lineHeight: 'var(--lh-relaxed)' }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: '0.5rem' }}>{action}</div>}
    </motion.div>
  );
}
