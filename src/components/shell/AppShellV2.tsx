import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BottomNavigation, type BottomNavigationItem } from '../ui';
import type { IconName } from '../Icon';
import { OfflineBanner } from './OfflineBanner';
import { getActiveTab, isFullscreenRoute, TAB_ORDER, type TabKey } from '../../lib/routes/routeMeta';
import { layoutTabVariants, reducedTransition, transitionLayoutTab } from '../../lib/motion';
import styles from './AppShellV2.module.css';

const TAB_ROOT_PATH: Record<TabKey, string> = {
  home: '/',
  learn: '/learn',
  practice: '/practice',
  progress: '/progress',
  profile: '/profile',
};

const TAB_ICON: Record<TabKey, IconName> = {
  home: 'home',
  learn: 'study',
  practice: 'brain',
  progress: 'stats',
  profile: 'profile',
};

const TAB_LABEL: Record<TabKey, string> = {
  home: 'Головна',
  learn: 'Навчання',
  practice: 'Практика',
  progress: 'Прогрес',
  profile: 'Профіль',
};

const TAB_ITEMS: BottomNavigationItem<TabKey>[] = TAB_ORDER.map((key) => ({
  key,
  icon: TAB_ICON[key],
  label: TAB_LABEL[key],
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
 */
export function AppShellV2() {
  const location = useLocation();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  const activeTab = getActiveTab(location.pathname);
  const fullscreen = isFullscreenRoute(location.pathname);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Don't steal focus while a dialog/sheet has it trapped.
    if (document.activeElement?.closest('[role="dialog"]')) return;
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <div className={styles.shell}>
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
          items={TAB_ITEMS}
          active={activeTab}
          onSelect={(key) => navigate(TAB_ROOT_PATH[key])}
        />
      )}
    </div>
  );
}
