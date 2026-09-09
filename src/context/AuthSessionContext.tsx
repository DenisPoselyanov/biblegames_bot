import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import {
  WebApp,
  initTelegramWebApp,
  isInsideTelegram,
} from '../lib/telegram';

type TelegramUser = NonNullable<typeof WebApp.initDataUnsafe>['user'];

export interface AuthSessionValue {
  webApp: typeof WebApp;
  user: TelegramUser | undefined;
  /** Telegram user id as a string, or `'guest'` outside Telegram. */
  userId: string;
  displayName: string;
  isTelegram: boolean;
}

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

/**
 * App-scoped session identity. The Telegram principal is the only source today;
 * this is the seam where a real auth provider would slot in. Sits outermost so
 * `initTelegramWebApp()` runs exactly once and every hook reads one principal.
 */
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initTelegramWebApp();
  }, []);

  const user = useMemo(() => WebApp.initDataUnsafe?.user, []);

  const value = useMemo<AuthSessionValue>(() => {
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
  }, [user]);

  return (
    <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
  );
}

export function useAuthSession(): AuthSessionValue {
  const ctx = useContext(AuthSessionContext);
  if (!ctx) throw new Error('useAuthSession must be used within AuthSessionProvider');
  return ctx;
}
