import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import styles from './Layout.module.css';

export function Layout() {
  const location = useLocation();
  const hideNav =
    location.pathname.includes('/quiz/') ||
    location.pathname.includes('/kahoot/room/');

  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <Outlet />
      </main>
      {!hideNav && (
        <nav className={styles.nav} aria-label="Основна навігація">
          <NavLink to="/" end className={({ isActive }) => (isActive ? styles.active : '')}>
            <Icon name="home" size={22} aria-label="Головна" />
            <small>Головна</small>
          </NavLink>
          <NavLink to="/play" className={({ isActive }) => (isActive ? styles.active : '')}>
            <Icon name="play" size={22} aria-label="Гра" />
            <small>Гра</small>
          </NavLink>
          <NavLink to="/shop" className={({ isActive }) => (isActive ? styles.active : '')}>
            <Icon name="shop" size={22} aria-label="Крамниця" />
            <small>Крамниця</small>
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => (isActive ? styles.active : '')}>
            <Icon name="profile" size={22} aria-label="Профіль" />
            <small>Профіль</small>
          </NavLink>
        </nav>
      )}
    </div>
  );
}
