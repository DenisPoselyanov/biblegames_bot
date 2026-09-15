import { useEffect } from 'react';
import { pushBackHandler } from '../lib/telegram';

/**
 * Wires Escape and Telegram's native BackButton to `onClose` while `active`
 * (§20.3 "Escape/back handling"). Registers through the shared back-handler
 * stack so it takes priority over the route-level BackButton handler and
 * correctly hands control back on close, including for nested overlays.
 */
export function useOverlayDismiss(active: boolean, onClose: (() => void) | undefined): void {
  useEffect(() => {
    if (!active || !onClose) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const popBackHandler = pushBackHandler(onClose);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      popBackHandler();
    };
  }, [active, onClose]);
}
