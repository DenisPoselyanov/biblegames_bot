import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WebApp, initTelegramWebApp, isInsideTelegram, showBackButton, hideBackButton } from '../lib/telegram';

export function useTelegram() {
  const user = useMemo(() => WebApp.initDataUnsafe?.user, []);

  useEffect(() => {
    initTelegramWebApp();
  }, []);

  const userId = user?.id?.toString() ?? 'guest';
  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.username ||
    'Гість';

  return {
    webApp: WebApp,
    user,
    userId,
    displayName,
    isTelegram: isInsideTelegram(),
  };
}

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
