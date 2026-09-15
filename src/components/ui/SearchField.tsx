import type { ChangeEvent } from 'react';
import { Icon } from '../Icon';
import { cx } from './cx';
import styles from './SearchField.module.css';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

/** Debounce, if needed for a server query, is the caller's responsibility (§13.2). */
export function SearchField({ value, onChange, placeholder = 'Пошук', label, className }: SearchFieldProps) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
  }

  return (
    <div className={cx(styles.field, className)}>
      <span className={styles.icon} aria-hidden="true">
        <Icon name="search" size={18} />
      </span>
      <input
        type="search"
        className={styles.input}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
      />
      {value.length > 0 && (
        <button type="button" className={styles.clear} onClick={() => onChange('')} aria-label="Очистити пошук">
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}
