import type { ReactNode } from 'react';
import { Icon } from '../Icon';
import { cx } from './cx';
import styles from './AchievementBadge.module.css';

interface AchievementBadgeProps {
  icon: ReactNode;
  label: string;
  /** Locked achievements stay in the frame — accessible name explains the state, not just a dimmed icon (§17.4). */
  locked?: boolean;
  className?: string;
}

export function AchievementBadge({ icon, label, locked, className }: AchievementBadgeProps) {
  return (
    <div className={cx(styles.badge, className)}>
      <div className={cx(styles.frame, locked && styles['frame--locked'])} aria-hidden="true">
        {locked ? <Icon name="lock" size={22} /> : icon}
      </div>
      <span className={cx(styles.label, locked && styles['label--locked'])}>
        {label}
        {locked ? ' (заблоковано)' : ''}
      </span>
    </div>
  );
}
