import { useEffect, useRef, useState } from 'react';
import { consumeEventOnce } from '../lib/eventDedup';

/**
 * Returns `true` exactly once for a given authoritative `eventId` — the
 * signal a celebration/reward component gates its `active` prop on (ADR-010,
 * MOTION_SYSTEM.md §4.3/§21). `false` for `undefined`/`null` (no event yet)
 * and for any eventId already consumed in a prior mount, reload or reconnect.
 *
 * Example: `const celebrate = useEventOnce(levelUpResult?.eventId);` then
 * `<CelebrationLayer active={celebrate} />`.
 */
export function useEventOnce(eventId: string | null | undefined): boolean {
  const [isFirst, setIsFirst] = useState(false);
  // Guards against React StrictMode's dev-only double-invoke of this effect
  // re-consuming the same id within one real mount; a genuine remount gets a
  // fresh ref and re-checks the persisted store in lib/eventDedup.ts.
  const resolvedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    if (resolvedForRef.current === eventId) return;
    resolvedForRef.current = eventId;
    setIsFirst(consumeEventOnce(eventId));
  }, [eventId]);

  return eventId ? isFirst : false;
}
