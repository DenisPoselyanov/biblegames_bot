import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Tabbar } from 'react-vant';
import { Icon } from './Icon';
import { isFeatureEnabled } from '../lib/flags';
import styles from './Layout.module.css';

const learningFirstNav = isFeatureEnabled('learning_first_navigation');
const playTabLabel = learningFirstNav ? 'Навчання' : 'Гра';

type TabKey = 'home' | 'play' | 'shop' | 'profile';

const TAB_ROUTES: Record<TabKey, string> = {
  home: '/',
  play: '/play',
  shop: '/shop',
  profile: '/profile',
};

function getTabKey(pathname: string): TabKey {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/play')) return 'play';
  if (pathname.startsWith('/shop')) return 'shop';
  if (
    pathname.startsWith('/profile') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/stats') ||
    pathname.startsWith('/social')
  ) {
    return 'profile';
  }
  return 'home';
}

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const tabKey = getTabKey(location.pathname);
  const hideNav =
    location.pathname.includes('/quiz/') ||
    location.pathname.includes('/kahoot/room/');

  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <div className={styles.pageTransition}>
          <Outlet />
        </div>
      </main>
      {!hideNav && (
        <Tabbar
          className={styles.tabbar}
          fixed
          safeAreaInsetBottom
          placeholder
          value={tabKey}
          activeColor="var(--gold)"
          inactiveColor="var(--text-muted)"
          onChange={(name) => navigate(TAB_ROUTES[name as TabKey])}
        >
          <Tabbar.Item name="home" icon={<Icon name="home" size={22} aria-hidden />}>
            Головна
          </Tabbar.Item>
          <Tabbar.Item name="play" icon={<Icon name="play" size={22} aria-hidden />}>
            {playTabLabel}
          </Tabbar.Item>
          <Tabbar.Item name="shop" icon={<Icon name="shop" size={22} aria-hidden />}>
            Крамниця
          </Tabbar.Item>
          <Tabbar.Item name="profile" icon={<Icon name="profile" size={22} aria-hidden />}>
            Профіль
          </Tabbar.Item>
        </Tabbar>
      )}
    </div>
  );
}
