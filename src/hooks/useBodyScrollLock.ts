import { useEffect } from 'react';

let lockCount = 0;
let previousOverflow = '';

function lock() {
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
}

function unlock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = previousOverflow;
  }
}

/**
 * Ref-counted body scroll lock (§20.3). Safe with multiple simultaneously-open
 * overlays — e.g. a confirm dialog opened on top of a sheet — unlike a naive
 * save/restore that would unlock scroll as soon as the *inner* one closes.
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    lock();
    return unlock;
  }, [active]);
}
