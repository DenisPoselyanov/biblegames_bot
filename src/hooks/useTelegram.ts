import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { showBackButton, hideBackButton } from '../lib/telegram';
import { useAuthSession } from '../context/AuthSessionContext';

/**
 * Back-compat alias for the session principal. New code should call
 * `useAuthSession()` from `context/AuthSessionContext` directly.
 */
export const useTelegram = useAuthSession;

const TAB_ROOT_PATHS = new Set(['/', '/play', '/shop', '/profile']);

/** Sync Telegram's native BackButton with the router: hidden on the four tab roots, shown (navigate(-1) on tap) everywhere else. */
export function useTelegramBackButton(): void {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = () => navigate(-1);
    if (TAB_ROOT_PATHS.has(location.pathname)) {
      hideBackButton(onClick);
      return;
    }
    showBackButton(onClick);
    return () => hideBackButton(onClick);
  }, [location.pathname, navigate]);
}
