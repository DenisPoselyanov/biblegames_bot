import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { pushBackHandler } from '../lib/telegram';
import { useAuthSession } from '../context/AuthSessionContext';

/**
 * Back-compat alias for the session principal. New code should call
 * `useAuthSession()` from `context/AuthSessionContext` directly.
 */
export const useTelegram = useAuthSession;

const TAB_ROOT_PATHS = new Set(['/', '/play', '/shop', '/profile']);

/**
 * Sync Telegram's native BackButton with the router: hidden on the four tab
 * roots, shown (navigate(-1) on tap) everywhere else. Registers through the
 * shared back-handler stack (`pushBackHandler`) so an open MotionSheet/
 * MotionDialog can temporarily take over the button instead of this handler
 * firing underneath it.
 */
export function useTelegramBackButton(): void {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (TAB_ROOT_PATHS.has(location.pathname)) return;
    return pushBackHandler(() => navigate(-1));
  }, [location.pathname, navigate]);
}
