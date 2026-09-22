import { cx } from './cx';
import styles from './SectionHeader.module.css';

interface SectionHeaderProps {
  title: string;
  /**
   * One muted line under the title — the section's own footnote ("Оплата
   * монетами"). Lives inside the header block so the title keeps a single
   * gap to the content it introduces, instead of every page inventing its
   * own hint paragraph and margins.
   */
  note?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/** Compact section title with an optional note line and trailing text action ("Усі" / "Показати все"). */
export function SectionHeader({ title, note, actionLabel, onAction, className }: SectionHeaderProps) {
  return (
    <div className={cx(styles.header, className)}>
      <div className={styles.main}>
        <h2 className={styles.title}>{title}</h2>
        {note && <p className={styles.note}>{note}</p>}
      </div>
      {actionLabel && onAction && (
        <button type="button" className={styles.action} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
