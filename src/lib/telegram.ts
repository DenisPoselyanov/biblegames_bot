import WebApp from '@twa-dev/sdk';

/** Безпечний виклик методів Telegram WebApp (працює і в браузері поза Telegram). */
export function initTelegramWebApp(): void {
  if (typeof WebApp.ready === 'function') {
    WebApp.ready();
  }
  if (typeof WebApp.expand === 'function') {
    WebApp.expand();
  }
  if (typeof WebApp.setHeaderColor === 'function') {
    WebApp.setHeaderColor('#1a1208');
  }
  if (typeof WebApp.setBackgroundColor === 'function') {
    WebApp.setBackgroundColor('#1a1208');
  }
}

export function isInsideTelegram(): boolean {
  return Boolean(WebApp.initDataUnsafe?.user?.id);
}

export const haptic = {
  impact: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light') => {
    try {
      if (WebApp.HapticFeedback) {
        WebApp.HapticFeedback.impactOccurred(style);
      }
    } catch (e) {
      console.warn('Haptic impact failed:', e);
    }
  },
  notification: (type: 'error' | 'success' | 'warning') => {
    try {
      if (WebApp.HapticFeedback) {
        WebApp.HapticFeedback.notificationOccurred(type);
      }
    } catch (e) {
      console.warn('Haptic notification failed:', e);
    }
  },
  selection: () => {
    try {
      if (WebApp.HapticFeedback) {
        WebApp.HapticFeedback.selectionChanged();
      }
    } catch (e) {
      console.warn('Haptic selection failed:', e);
    }
  },
};

export { WebApp };
