import { useEffect, useState } from 'react';

const STORAGE_PREFIX = 'motion-seen:';

export function useMotionEntrance(surfaceId: string): { shouldEnter: boolean } {
  const storageKey = `${STORAGE_PREFIX}${surfaceId}`;
  const [shouldEnter] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey) !== '1';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  return { shouldEnter };
}
