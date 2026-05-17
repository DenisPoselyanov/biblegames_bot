import { NavLink, Outlet, useLocation } from 'react-router-dom';
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
        <nav className={styles.nav}>
          <NavLink to="/" end className={({ isActive }) => (isActive ? styles.active : '')}>
            <span>🏠</span>
            <small>Головна</small>
          </NavLink>
          <NavLink to="/play" className={({ isActive }) => (isActive ? styles.active : '')}>
            <span>🎮</span>
            <small>Гра</small>
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => (isActive ? styles.active : '')}>
            <span>👤</span>
            <small>Профіль</small>
          </NavLink>
          <NavLink to="/stats" className={({ isActive }) => (isActive ? styles.active : '')}>
            <span>🏆</span>
            <small>Рейтинг</small>
          </NavLink>
        </nav>
      )}
    </div>
  );
}
