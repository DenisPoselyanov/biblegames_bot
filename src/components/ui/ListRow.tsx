import type { ReactNode } from 'react';
import { Icon } from '../Icon';
import { cx } from './cx';
import styles from './ListRow.module.css';

interface ListRowProps {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  /** Only rows that navigate get a chevron (§11.3 — not a decoration on static info). */
  navigates?: boolean;
  onClick?: () => void;
  className?: string;
}

/** Stable min-height row for lists; the whole row is clickable, not just the leading icon (§11.3). */
export function ListRow({ leading, title, subtitle, trailing, navigates, onClick, className }: ListRowProps) {
  const content = (
    <>
      {leading && <span className={styles.leading}>{leading}</span>}
      <span className={styles.main}>
        <span className={styles.title}>{title}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </span>
      {trailing && <span className={styles.trailing}>{trailing}</span>}
      {navigates && (
        <span className={styles.chevron} aria-hidden="true">
          <Icon name="chevron-right" size={18} />
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={cx(styles.row, styles['row--interactive'], className)} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={cx(styles.row, className)}>{content}</div>;
}
