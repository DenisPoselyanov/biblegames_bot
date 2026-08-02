import styles from './StreakBadge.module.css';

interface StreakBadgeProps {
  streakDays: number;
}

export function StreakBadge({ streakDays }: StreakBadgeProps) {
  const icon = streakDays >= 3 ? '🔥' : streakDays >= 1 ? '✨' : '📅';
  return (
    <span className={styles.badge}>
      <span className={styles.icon} aria-hidden>
        {icon}
      </span>
      <span className={styles.value}>{streakDays}</span>
      <span className={styles.label}>серія</span>
    </span>
  );
}
