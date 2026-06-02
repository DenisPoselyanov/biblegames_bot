import { motion } from 'framer-motion';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { tapSpring } from '../lib/motion';
import { Icon } from './Icon';
import styles from './Layout.module.css';

function getTabKey(pathname: string): string {
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
  return pathname;
}

function NavItem({
  to,
  end,
  label,
  icon,
}: {
  to: string;
  end?: boolean;
  label: string;
  icon: 'home' | 'play' | 'shop' | 'profile';
}) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => (isActive ? styles.active : '')}>
      <motion.span
        className={styles.navItemInner}
        whileTap={{ scale: 0.95 }}
        transition={tapSpring}
      >
        <Icon name={icon} size={22} aria-label={label} />
        <small>{label}</small>
      </motion.span>
    </NavLink>
  );
}

export function Layout() {
  const location = useLocation();
  const tabKey = getTabKey(location.pathname);
  const hideNav =
    location.pathname.includes('/quiz/') ||
    location.pathname.includes('/kahoot/room/');

  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <div key={tabKey} className={styles.pageTransition}>
          <Outlet />
        </div>
      </main>
      {!hideNav && (
        <nav className={styles.nav} aria-label="Основна навігація">
          <NavItem to="/" end label="Головна" icon="home" />
          <NavItem to="/play" label="Гра" icon="play" />
          <NavItem to="/shop" label="Крамниця" icon="shop" />
          <NavItem to="/profile" label="Профіль" icon="profile" />
        </nav>
      )}
    </div>
  );
}
