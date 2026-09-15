import type { ButtonHTMLAttributes } from 'react';
import { type IconName, Icon } from '../Icon';
import { cx } from './cx';
import styles from './IconButton.module.css';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  icon: IconName;
  label: string;
  size?: number;
  variant?: 'plain' | 'surface';
  active?: boolean;
  className?: string;
}

/** 44×44 minimum touch target (§21). `label` is required — icon-only controls must have an accessible name. */
export function IconButton({
  icon,
  label,
  size = 20,
  variant = 'plain',
  active,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cx(
        styles.button,
        variant === 'surface' && styles['button--surface'],
        active && styles['button--active'],
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}
