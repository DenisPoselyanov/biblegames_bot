import { cx } from './cx';
import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  /** 0-100. Value is server-authoritative — this component never invents progress (§17.1). */
  value: number;
  label?: string;
  showValue?: boolean;
  className?: string;
}

export function ProgressBar({ value, label, showValue, className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cx(styles.wrapper, className)}>
      {(label || showValue) && (
        <div className={styles.labelRow}>
          {label && <span>{label}</span>}
          {showValue && <span className={styles.value}>{Math.round(pct)}%</span>}
        </div>
      )}
      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
