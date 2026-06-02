import WebApp from '@twa-dev/sdk';

export function initTelegramWebApp(): void {
  if (typeof WebApp.ready === 'function') {
    WebApp.ready();
  }
  if (typeof WebApp.expand === 'function') {
    WebApp.expand();
  }
  if (typeof WebApp.setHeaderColor === 'function') {
    WebApp.setHeaderColor('#101820');
  }
  if (typeof WebApp.setBackgroundColor === 'function') {
    WebApp.setBackgroundColor('#101820');
  }

  syncTelegramTheme();
}

export function isInsideTelegram(): boolean {
  return Boolean(WebApp.initDataUnsafe?.user?.id);
}

/** Відкрити зовнішнє посилання (браузер / Telegram in-app browser). */
export function openExternalLink(url: string): void {
  const target = url.trim();
  if (!target) return;

  if (isInsideTelegram()) {
    try {
      WebApp.openLink(target, { try_instant_view: false });
      return;
    } catch (e) {
      console.warn('openLink failed:', e);
    }
  }

  const opened = window.open(target, '_blank', 'noopener,noreferrer');
  if (!opened) {
    window.location.assign(target);
  }
}

export function getTelegramInitData(): string {
  return WebApp.initData ?? '';
}

export function getTelegramStartParam(): string {
  try {
    return WebApp.initDataUnsafe?.start_param ?? '';
  } catch {
    return '';
  }
}

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || 'biblegames_bot';

export function buildKahootStartLink(code: string): string {
  const param = `kahoot_${code.toUpperCase()}`;
  return `https://t.me/${BOT_USERNAME}?startapp=${param}`;
}

export function parseKahootCodeFromStartParam(startParam: string): string | null {
  const match = /^kahoot_([A-Z0-9]{6})$/i.exec(startParam.trim());
  return match ? match[1].toUpperCase() : null;
}

export function shareKahootRoom(code: string, title?: string): void {
  const link = buildKahootStartLink(code);
  const text = title
    ? `${title}\nКод: ${code}\nПриєднуйся до Kahoot!`
    : `Код кімнати: ${code}\nПриєднуйся до біблійної гри Kahoot!`;
  try {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    WebApp.openTelegramLink?.(shareUrl);
  } catch {
    void navigator.clipboard?.writeText(`${text}\n${link}`);
  }
}

export function copyKahootCode(code: string): void {
  try {
    void navigator.clipboard?.writeText(code);
  } catch {
    /* ignore */
  }
}

/** Sync Telegram header/background with active cosmetic theme */
export function syncTelegramChromeColors(backgroundColor: string): void {
  try {
    const color = backgroundColor as `#${string}`;
    if (typeof WebApp.setHeaderColor === 'function') {
      WebApp.setHeaderColor(color);
    }
    if (typeof WebApp.setBackgroundColor === 'function') {
      WebApp.setBackgroundColor(color);
    }
  } catch (e) {
    console.warn('Telegram chrome color sync failed:', e);
  }
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
    WebApp.MainButton.offClick(() => {});
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
