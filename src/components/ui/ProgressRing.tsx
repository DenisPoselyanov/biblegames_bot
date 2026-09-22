import type { ReactNode } from 'react';
import { cx } from './cx';
import styles from './ProgressRing.module.css';

interface ProgressRingProps {
  /** 0-100, server-authoritative (§17.1). */
  value: number;
  size?: number;
  strokeWidth?: number;
  /** Defaults to `${round(value)}%`. */
  centerLabel?: ReactNode;
  label?: string;
  className?: string;
  /** Fixed white/frosted stroke + text — for placement on a `HeroCard tone="cover"` (Phase 3.5 §4). */
  onColor?: boolean;
}

export function ProgressRing({
  value,
  size = 72,
  strokeWidth = 6,
  centerLabel,
  label,
  className,
  onColor,
}: ProgressRingProps) {
  const pct = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div
      className={cx(styles.wrapper, onColor && styles['wrapper--onColor'], className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* design-v2 ramp (proto `Ring`): indigo -> violet -> theme ramp end.
            Referenced from CSS so pre-3.5 themes keep their flat fill. The id
            is intentionally stable — every instance renders the same stops. */}
        <defs>
          <linearGradient id="uiProgressRingRamp" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--progress-fill)" />
            <stop offset="55%" stopColor="var(--brand-primary-hover)" />
            <stop offset="100%" stopColor="var(--progress-ramp-end)" />
          </linearGradient>
        </defs>
        <circle className={styles.track} cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill="none" />
        <circle
          className={styles.fill}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className={styles.center} style={{ fontSize: size * 0.22 }}>
        {centerLabel ?? `${Math.round(pct)}%`}
      </span>
    </div>
  );
}
