import type { ReactNode } from 'react';
import { CoverArt } from './CoverArt';
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
  /**
   * `surface` (default): the existing warm-card look, optionally with
   * `imageSrc`. `cover` (Phase 3.5 §4/§6 WS3): a full-bleed generated
   * `CoverArt` background with white text over a scrim — the "screen's main
   * object" pattern (Урок дня / Гра тижня). Requires `coverSeed`.
   */
  tone?: 'surface' | 'cover';
  coverSeed?: string;
  coverGlyph?: 'rays' | 'path' | 'wave';
  /** Top-pinned badge row — only meaningful with `tone="cover"`. */
  badges?: ReactNode;
}

/**
 * The one dominant hero block per first viewport (DESIGN_RULES §7.2). Image
 * is optional and always covered by a top-to-transparent overlay so text
 * stays readable (§12.3) — screen must not lose function if the image fails.
 */
export function HeroCard({
  kicker,
  title,
  description,
  imageSrc,
  imageAlt,
  footer,
  className,
  tone = 'surface',
  coverSeed,
  coverGlyph,
  badges,
}: HeroCardProps) {
  if (tone === 'cover' && coverSeed) {
    return (
      <div className={cx(styles.hero, styles['hero--cover'], className)}>
        <CoverArt seed={coverSeed} glyph={coverGlyph} scrim className={styles.coverLayer} />
        <div className={styles.coverContent}>
          {badges && <div className={styles.badgeRow}>{badges}</div>}
          {kicker && <p className={styles.coverKicker}>{kicker}</p>}
          <h2 className={styles.coverTitle}>{title}</h2>
          {description && <p className={styles.coverDescription}>{description}</p>}
          {footer && <div className={styles.coverFooter}>{footer}</div>}
        </div>
      </div>
    );
  }

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
