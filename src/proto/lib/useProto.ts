import { useContext } from 'react';
import { ProtoContext, type ProtoStore } from './protoContext';

export function useProto(): ProtoStore {
  const store = useContext(ProtoContext);
  if (!store) throw new Error('useProto must be used inside ProtoStoreProvider');
  return store;
}

/** XP needed to close the current level — keeps the header ring honest. */
export function levelProgress(xp: number): { level: number; pct: number; toNext: number } {
  const span = 500;
  const level = Math.floor(xp / span) + 1;
  const into = xp % span;
  return { level, pct: into / span, toNext: span - into };
}
