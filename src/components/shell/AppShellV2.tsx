import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BottomNavigation, type BottomNavigationItem } from '../ui';
import type { IconName } from '../Icon';
import { OfflineBanner } from './OfflineBanner';
import { ShellAurora } from './ShellAurora';
import { getActiveTab, isFullscreenRoute, TAB_ORDER, type TabKey } from '../../lib/routes/routeMeta';
import { layoutTabVariants, reducedTransition, transitionLayoutTab } from '../../lib/motion';
import { isFeatureEnabled } from '../../lib/flags';
import styles from './AppShellV2.module.css';

const TAB_ROOT_PATH: Record<TabKey, string> = {
  home: '/',
  learn: '/learn',
  play: '/play',
  progress: '/progress',
  profile: '/profile',
};

// Design-v2 (Phase 3.5 §6): the prototype's tab set — lucide glyphs and the
// shorter, warmer labels ("Сьогодні", "Грати", "Я"), not the Phase 3 ones.
const TAB_ICON_V2: Record<TabKey, IconName> = {
  home: 'sparkles',
  learn: 'book-open',
  play: 'gamepad',
  progress: 'trending-up',
  profile: 'user',
};

const TAB_ICON: Record<TabKey, IconName> = {
  home: 'home',
  learn: 'study',
  play: 'play',
  progress: 'stats',
  profile: 'profile',
};

const TAB_LABEL_V2: Record<TabKey, string> = {
  home: 'Сьогодні',
  learn: 'Навчання',
  play: 'Грати',
  progress: 'Прогрес',
  profile: 'Я',
};

const TAB_LABEL: Record<TabKey, string> = {
  home: 'Головна',
  learn: 'Навчання',
  play: 'Гра',
  progress: 'Прогрес',
  profile: 'Профіль',
};

const TAB_ITEMS: BottomNavigationItem<TabKey>[] = TAB_ORDER.map((key) => ({
  key,
  icon: TAB_ICON[key],
  label: TAB_LABEL[key],
}));

const TAB_ITEMS_V2: BottomNavigationItem<TabKey>[] = TAB_ORDER.map((key) => ({
  key,
  icon: TAB_ICON_V2[key],
  label: TAB_LABEL_V2[key],
}));

/**
 * v2 app shell (§6), active only behind `learningShellV2`. Owns: bottom nav
 * (route-metadata-driven, not string matching — §6 "Navigation state"), the
 * route transition container, the offline/reconnect banner, a skip link, and
 * focus restoration on navigation.
 *
 * Not duplicated here (already handled elsewhere, app-wide, regardless of
 * shell version): Telegram header/background sync (`CosmeticThemeSync`, fires
 * on mount + every theme change), toast region (`ToastProvider`, mounted once
 * at the app root), modal/sheet portals (`MotionSheet`/`MotionDialog` are
 * self-contained portals — see `BottomSheet`/`Dialog`), safe-area insets for
 * page content (`AppPage`, per-page).
 *
 * WS2 (`PHASE_3_5_DESIGN_V2_VISUAL_MIGRATION.md` §6): behind `designSystemV2`,
 * also renders the `ShellAurora` background layer and switches
 * `BottomNavigation` to its floating-pill visual. Flag off reproduces the
 * exact pre-migration render — no aurora layer, default nav — same
 * rollback contract `learningShellV2` itself already relies on.
 */
export function AppShellV2() {
  const location = useLocation();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);
  const designSystemV2 = isFeatureEnabled('designSystemV2');

  const activeTab = getActiveTab(location.pathname);
  const fullscreen = isFullscreenRoute(location.pathname);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Don't steal focus while a dialog/sheet has it trapped.
    if (document.activeElement?.closest('[role="dialog"]')) return;
    const container = mainRef.current;
    if (!container) return;

    // §17: focus moves to the screen's heading, not just the landmark — most
    // routes render one <h1> via PageHeader; routes without one (ComingSoon,
    // fullscreen game modes, legacy pages) fall back to <main>. The entering
    // route's content isn't in the DOM synchronously with this effect —
    // AnimatePresence mode="wait" keeps the OLD page mounted through its exit
    // animation first — so a plain querySelector('h1') right now would match
    // the outgoing heading, which gets unmounted a moment later and drops
    // focus to <body>. Watch for a newly *inserted* h1 instead of guessing a
    // delay tied to the current transition duration.
    const findInsertedHeading = (mutations: MutationRecord[]): HTMLElement | null => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.tagName === 'H1') return node;
          const nested = node.querySelector<HTMLElement>('h1');
          if (nested) return nested;
        }
      }
      return null;
    };

    const observer = new MutationObserver((mutations) => {
      const heading = findInsertedHeading(mutations);
      if (!heading) return;
      observer.disconnect();
      window.clearTimeout(fallbackTimeout);
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    });
    observer.observe(container, { childList: true, subtree: true });
    // Routes with no heading (ComingSoon, legacy pages) never satisfy the
    // observer — fall back to focusing <main> once the transition has had
    // time to settle instead of waiting indefinitely.
    const fallbackTimeout = window.setTimeout(() => {
      observer.disconnect();
      container.focus({ preventScroll: true });
    }, 500);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallbackTimeout);
    };
  }, [location.pathname]);

  return (
    <div className={styles.shell}>
      {designSystemV2 && <ShellAurora />}
      <a className={styles.skipLink} href="#app-shell-main">
        До вмісту
      </a>
      <OfflineBanner />
      <main id="app-shell-main" className={styles.main} ref={mainRef} tabIndex={-1}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={layoutTabVariants}
            transition={reducedTransition(transitionLayoutTab, !!reduced)}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      {!fullscreen && (
        <BottomNavigation
          items={designSystemV2 ? TAB_ITEMS_V2 : TAB_ITEMS}
          active={activeTab}
          onSelect={(key) => navigate(TAB_ROOT_PATH[key])}
          variant={designSystemV2 ? 'aurora' : 'default'}
        />
      )}
    </div>
  );
}
