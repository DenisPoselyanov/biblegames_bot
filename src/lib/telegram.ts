import WebApp from '@twa-dev/sdk';

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

  syncTelegramTheme();
}

export function isInsideTelegram(): boolean {
  return Boolean(WebApp.initDataUnsafe?.user?.id);
}

/** Apply Telegram theme colors to CSS custom properties */
export function syncTelegramTheme(): void {
  try {
    const tp = WebApp.themeParams;
    if (!tp) return;
    const root = document.documentElement;
    if (tp.bg_color) root.style.setProperty('--tg-bg', tp.bg_color);
    if (tp.text_color) root.style.setProperty('--tg-text', tp.text_color);
    if (tp.hint_color) root.style.setProperty('--tg-hint', tp.hint_color);
    if (tp.link_color) root.style.setProperty('--tg-link', tp.link_color);
    if (tp.button_color) root.style.setProperty('--tg-button', tp.button_color);
    if (tp.button_text_color) root.style.setProperty('--tg-button-text', tp.button_text_color);
    if (tp.secondary_bg_color) root.style.setProperty('--tg-secondary-bg', tp.secondary_bg_color);
  } catch (e) {
    console.warn('Telegram theme sync failed:', e);
  }
}

/** Show/hide Telegram MainButton with text and callback */
export function showMainButton(text: string, onClick: () => void): void {
  try {
    if (!WebApp.MainButton) return;
    WebApp.MainButton.setText(text);
    WebApp.MainButton.onClick(onClick);
    WebApp.MainButton.show();
  } catch (e) {
    console.warn('MainButton failed:', e);
  }
}

export function hideMainButton(): void {
  try {
    if (!WebApp.MainButton) return;
    WebApp.MainButton.offClick();
    WebApp.MainButton.hide();
  } catch (e) {
    console.warn('MainButton hide failed:', e);
  }
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
