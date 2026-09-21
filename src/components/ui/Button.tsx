import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'gold' | 'danger' | 'onColor';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  fullWidth?: boolean;
  className?: string;
}

/**
 * One button primitive, six semantic variants (DESIGN_RULES §12). `primary`
 * fills navy (flat) on the `light` theme and keeps each other theme's
 * existing gradient CTA look via `--button-primary-bg`. `gold` is reserved
 * for premium/spiritual-accent actions, not a default CTA (§9.3/§12.4).
 * `onColor` (Phase 3.5 §4) is a fixed white pill for a primary CTA sitting on
 * a colored `CoverArt` hero — deliberately theme-independent, since it exists
 * to keep contrast against a brand-gradient background, not to match a
 * theme's palette.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        styles.button,
        styles[`button--${variant}`],
        size === 'sm' && styles['button--sm'],
        fullWidth && styles['button--fullWidth'],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
