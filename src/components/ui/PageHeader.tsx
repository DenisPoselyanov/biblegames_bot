import type { ReactNode } from 'react';
import { Icon } from '../Icon';
import { cx } from './cx';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  /** Short uppercase eyebrow above the title — spiritual accent, not a heading. */
  kicker?: string;
  title: string;
  description?: string;
  onBack?: () => void;
  action?: ReactNode;
  className?: string;
}

/**
 * Serif page title with optional kicker/description, back button and one
 * trailing action slot. Serif is reserved for the title per DESIGN_RULES §6.2 —
 * kicker/description stay on the UI sans font.
 */
export function PageHeader({ kicker, title, description, onBack, action, className }: PageHeaderProps) {
  return (
    <header className={cx(styles.header, className)}>
      {onBack && (
        <button type="button" className={styles.backButton} onClick={onBack} aria-label="Назад">
          <Icon name="back" size={20} />
        </button>
      )}
      <div className={styles.headerMain}>
        {kicker && <p className={styles.kicker}>{kicker}</p>}
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </header>
  );
}
