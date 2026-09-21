import type { ReactNode } from 'react';
import { cx } from './cx';
import styles from './Pill.module.css';

interface PillProps {
  children: ReactNode;
  icon?: ReactNode;
  /** `neutral` (default surface chip), `accent` (gold-tinted), `onColor` (frosted white — for placement on `CoverArt`). */
  tone?: 'neutral' | 'accent' | 'onColor';
  className?: string;
}

/** Small rounded meta chip — plan/module counts, badges on a hero cover, testament tags. */
export function Pill({ children, icon, tone = 'neutral', className }: PillProps) {
  return (
    <span className={cx(styles.pill, styles[`pill--${tone}`], className)}>
      {icon}
      {children}
    </span>
  );
}
