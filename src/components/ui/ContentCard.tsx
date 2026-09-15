import type { ReactNode } from 'react';
import { cx } from './cx';
import styles from './ContentCard.module.css';

interface ContentCardProps {
  children: ReactNode;
  className?: string;
  /** `standard` (default, 20-24px padding) or `compact` (16px, smaller radius). */
  variant?: 'standard' | 'compact';
  /** No padding, clips content — for cards that render their own full-bleed media. */
  flush?: boolean;
  onClick?: () => void;
  'aria-label'?: string;
}

/**
 * Generic warm-white surface primitive (DESIGN_RULES §8.1/§11.1) — the base
 * every other card variant (HeroCard, MetricTile, ListRow's wrapper, ...)
 * builds on. Renders a <button> when `onClick` is given, a <div> otherwise.
 */
export function ContentCard({
  children,
  className,
  variant = 'standard',
  flush,
  onClick,
  'aria-label': ariaLabel,
}: ContentCardProps) {
  const classes = cx(
    styles.card,
    variant === 'compact' && styles['card--compact'],
    flush && styles['card--flush'],
    onClick && styles['card--interactive'],
    className,
  );

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} aria-label={ariaLabel}>
        {children}
      </button>
    );
  }

  return <div className={classes}>{children}</div>;
}
