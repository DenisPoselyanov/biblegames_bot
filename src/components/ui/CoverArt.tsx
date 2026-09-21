import type { CSSProperties } from 'react';
import { cx } from './cx';
import styles from './CoverArt.module.css';

type Glyph = 'rays' | 'path' | 'wave';

interface CoverArtProps {
  /** Any stable id (plan/module/lesson id) — deterministically varies the hue so each card reads as its own. */
  seed: string;
  glyph?: Glyph;
  /** Darkens the lower half so white text/badges stay readable on top (Phase 3.5 §4 hero-card pattern). */
  scrim?: boolean;
  /** Fades the bottom edge into the page background instead of a hard crop — for a card-inset cover, not a full-bleed one. */
  fade?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Generated cover art (Phase 3.5 §4/§6 WS3): a brand-gradient field plus a
 * thin line-art glyph, no image assets. Colors come from the active theme's
 * `--brand-primary`/`--accent-spiritual` tokens (not hardcoded hex) so it
 * reads correctly under every `CosmeticTheme`, not just `aurora`. `seed`
 * only rotates the hue slightly so repeated plans/lessons don't look
 * identical — it never changes which two tokens anchor the gradient.
 */
export function CoverArt({ seed, glyph = 'rays', scrim, fade, className, style }: CoverArtProps) {
  const hueShift = hueShiftFromSeed(seed);
  return (
    <div className={cx(styles.cover, className)} style={style} aria-hidden="true">
      <div className={styles.base} style={{ filter: `hue-rotate(${hueShift}deg)` }} />
      <div className={styles.glow} />
      <svg className={styles.glyph} viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
        <g stroke="rgba(255,255,255,0.32)" strokeWidth="1" fill="none">
          {glyph === 'rays' &&
            Array.from({ length: 9 }, (_, i) => (
              <line key={i} x1="230" y1="34" x2={40 + i * 34} y2="196" />
            ))}
          {glyph === 'path' && (
            <>
              <path d="M-10 150 C 70 120, 90 70, 170 60 S 290 30, 340 10" />
              <path d="M-10 172 C 80 146, 110 96, 190 86 S 300 56, 340 36" opacity="0.6" />
            </>
          )}
          {glyph === 'wave' &&
            Array.from({ length: 5 }, (_, i) => (
              <path
                key={i}
                d={`M-10 ${70 + i * 26} C 60 ${50 + i * 26}, 120 ${96 + i * 26}, 200 ${74 + i * 26} S 300 ${44 + i * 26}, 340 ${64 + i * 26}`}
                opacity={0.8 - i * 0.13}
              />
            ))}
        </g>
      </svg>
      {fade && <div className={styles.fade} />}
      {scrim && <div className={styles.scrim} />}
    </div>
  );
}

/** Deterministic, no external hash dep — good enough for "looks different per id", not for anything security-sensitive. */
function hueShiftFromSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  return (hash % 60) - 30;
}
