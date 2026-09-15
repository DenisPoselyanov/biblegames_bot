import type { ReactNode } from 'react';
import { cx } from './cx';
import styles from './HeroCard.module.css';

interface HeroCardProps {
  kicker?: string;
  title: string;
  description?: string;
  /** Restrained background illustration — optional, always behind a readability overlay (§12.3). */
  imageSrc?: string;
  imageAlt?: string;
  /** Progress bar, primary CTA, or similar — DESIGN_RULES §8.2: one primary action, no CTA overload. */
  footer?: ReactNode;
  className?: string;
}

/**
 * The one dominant hero block per first viewport (DESIGN_RULES §7.2). Image
 * is optional and always covered by a top-to-transparent overlay so text
 * stays readable (§12.3) — screen must not lose function if the image fails.
 */
export function HeroCard({ kicker, title, description, imageSrc, imageAlt, footer, className }: HeroCardProps) {
  return (
    <div className={cx(styles.hero, className)}>
      {imageSrc && (
        <div className={styles.imageLayer} aria-hidden={!imageAlt}>
          <img src={imageSrc} alt={imageAlt ?? ''} loading="lazy" />
        </div>
      )}
      {imageSrc && <div className={styles.overlay} aria-hidden="true" />}
      <div className={styles.content}>
        {kicker && <p className={styles.kicker}>{kicker}</p>}
        <h2 className={styles.title}>{title}</h2>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
