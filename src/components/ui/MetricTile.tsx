import type { ReactNode } from 'react';
import { cx } from './cx';
import styles from './MetricTile.module.css';

interface MetricTileProps {
  icon?: ReactNode;
  value: ReactNode;
  label: string;
  className?: string;
}

/** Compact stat card — value is the primary element, label short, icon secondary (§11.4). */
export function MetricTile({ icon, value, label, className }: MetricTileProps) {
  return (
    <div className={cx(styles.tile, className)}>
      {icon && <span className={styles.iconRow}>{icon}</span>}
      <span className={styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}

/** Responsive grid for MetricTiles — wraps to fewer columns on narrow screens instead of shrinking density. */
export function MetricTileGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.grid, className)}>{children}</div>;
}
