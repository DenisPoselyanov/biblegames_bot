import type { ReactNode } from 'react';
import { Icon } from '../Icon';
import { cx } from './cx';
import styles from './AchievementBadge.module.css';

interface AchievementBadgeProps {
  icon: ReactNode;
  label: string;
  /** Locked achievements stay in the frame — accessible name explains the state, not just a dimmed icon (§17.4). */
  locked?: boolean;
  /** design-v2 (proto `Progress`): render as a grid tile card instead of a bare badge. */
  card?: boolean;
  className?: string;
}

export function AchievementBadge({ icon, label, locked, card, className }: AchievementBadgeProps) {
  return (
    <div className={cx(styles.badge, card && styles['badge--card'], locked && card && styles['badge--cardLocked'], className)}>
      <div className={cx(styles.frame, locked && styles['frame--locked'])} aria-hidden="true">
        {locked ? <Icon name="lock" size={22} /> : icon}
      </div>
      <span className={cx(styles.label, locked && styles['label--locked'])}>
        {label}
        {/* The locked state stays in the accessible name (§17.4); in the
            design-v2 tile it is announced rather than printed, since the
            dimmed lock glyph already carries it visually. */}
        {locked && (card ? <span className="sr-only"> (заблоковано)</span> : ' (заблоковано)')}
      </span>
    </div>
  );
}
