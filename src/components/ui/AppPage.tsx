import type { ReactNode } from 'react';
import { cx } from './cx';
import styles from './AppPage.module.css';

interface AppPageProps {
  children: ReactNode;
  className?: string;
  /** Set when the route hides the bottom nav (e.g. quiz/kahoot room) — skips the reserved tabbar padding. */
  noBottomNav?: boolean;
  /** Skip the default horizontal page padding for full-bleed content (e.g. a hero image). */
  noHorizontalPadding?: boolean;
}

/**
 * Root page shell: `--bg-app` canvas, safe-area top/bottom, capped content
 * width, and a vertical rhythm gap between sections. Does not render the
 * bottom nav itself — the app shell/route layout owns that (WS5).
 */
export function AppPage({ children, className, noBottomNav, noHorizontalPadding }: AppPageProps) {
  return (
    <div
      className={cx(
        styles.page,
        noBottomNav && styles['page--noNav'],
        noHorizontalPadding && styles['page--noPadX'],
        className,
      )}
    >
      {children}
    </div>
  );
}
