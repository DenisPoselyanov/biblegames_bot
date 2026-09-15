import type { KeyboardEvent } from 'react';
import { cx } from './cx';
import styles from './SegmentedControl.module.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: [SegmentedOption<T>, SegmentedOption<T>, ...SegmentedOption<T>[]];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  className?: string;
}

/** 2-4 mutually exclusive options (§9.5/§13.3). Arrow keys move focus+selection between segments. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const currentIndex = options.findIndex((o) => o.value === value);
    if (currentIndex === -1) return;
    const delta = e.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + delta + options.length) % options.length;
    e.preventDefault();
    onChange(options[nextIndex].value);
  }

  return (
    <div
      className={cx(styles.control, className)}
      role="radiogroup"
      aria-label={label}
      onKeyDown={handleKeyDown}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            className={cx(styles.option, active && styles['option--active'])}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
