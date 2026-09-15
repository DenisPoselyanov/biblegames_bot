import type { CosmeticTheme } from '../../data/cosmetics';
import { cx } from './cx';
import styles from './ThemePreview.module.css';

interface ThemePreviewProps {
  theme: CosmeticTheme;
  active?: boolean;
  onSelect?: () => void;
  className?: string;
}

/** Swatch card for a theme — background/surface/primary/accent/text dots + name (§23). */
export function ThemePreview({ theme, active, onSelect, className }: ThemePreviewProps) {
  const { preview } = theme;
  return (
    <button
      type="button"
      className={cx(styles.preview, active && styles['preview--active'], className)}
      onClick={onSelect}
      aria-pressed={active}
    >
      <span className={styles.swatch} style={{ background: preview.background }}>
        <span className={styles.dot} style={{ background: preview.surface }} />
        <span className={styles.dot} style={{ background: preview.primary }} />
        <span className={styles.dot} style={{ background: preview.accent }} />
        <span className={styles.dot} style={{ background: preview.text }} />
      </span>
      <span className={styles.meta}>
        <span className={styles.title}>{theme.title}</span>
        {active && <span className={styles.badge}>Активна</span>}
      </span>
    </button>
  );
}
