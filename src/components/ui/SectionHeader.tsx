import { cx } from './cx';
import styles from './SectionHeader.module.css';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/** Compact sans-serif section title with an optional trailing text action ("Усі" / "Показати все"). */
export function SectionHeader({ title, actionLabel, onAction, className }: SectionHeaderProps) {
  return (
    <div className={cx(styles.header, className)}>
      <h2 className={styles.title}>{title}</h2>
      {actionLabel && onAction && (
        <button type="button" className={styles.action} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
