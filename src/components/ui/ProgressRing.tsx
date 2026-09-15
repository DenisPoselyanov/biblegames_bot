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
}

export function ProgressRing({ value, size = 72, strokeWidth = 6, centerLabel, label, className }: ProgressRingProps) {
  const pct = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div
      className={cx(styles.wrapper, className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
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
