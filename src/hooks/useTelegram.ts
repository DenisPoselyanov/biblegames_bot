import { useEffect, useMemo } from 'react';
import { WebApp, initTelegramWebApp, isInsideTelegram } from '../lib/telegram';

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
