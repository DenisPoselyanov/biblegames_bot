import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Difficulty } from '../types';
import { MAX_STAGE_CAP, MIN_STAGE_CAP } from '../lib/practiceStageSettings';

export type NodeStageOverrides = Partial<Record<Difficulty, number>>;
export type NodeOverridesMap = Record<string, NodeStageOverrides>;

const STORAGE_KEY = 'biblegames_practice_node_stage_overrides';

function clampStageCount(_difficulty: Difficulty, count: number): number {
  const n = Math.round(count);
  if (!Number.isFinite(n)) return MIN_STAGE_CAP;
  return Math.min(MAX_STAGE_CAP, Math.max(MIN_STAGE_CAP, n));
}

function normalizeOverridesMap(overrides: NodeOverridesMap): NodeOverridesMap {
  const out: NodeOverridesMap = {};
  for (const [nodeId, entry] of Object.entries(overrides)) {
    if (!entry) continue;
    const normalized: NodeStageOverrides = {};
    for (const [difficulty, count] of Object.entries(entry)) {
      normalized[difficulty as Difficulty] = clampStageCount(
        difficulty as Difficulty,
        count ?? MIN_STAGE_CAP,
      );
    }
    if (Object.keys(normalized).length > 0) {
      out[nodeId] = normalized;
    }
  }
  return out;
}

interface PracticeNodeOverridesState {
  overrides: NodeOverridesMap;
  setNodeStageCount: (nodeId: string, difficulty: Difficulty, count: number) => void;
  resetNodeOverrides: (nodeId: string) => void;
  hasNodeOverrides: (nodeId: string) => boolean;
}

export const usePracticeNodeOverridesStore = create<PracticeNodeOverridesState>()(
  persist(
    (set, get) => ({
      overrides: {},
      setNodeStageCount: (nodeId, difficulty, count) => {
        const nextCount = clampStageCount(difficulty, count);
        set({
          overrides: {
            ...get().overrides,
            [nodeId]: {
              ...get().overrides[nodeId],
              [difficulty]: nextCount,
            },
          },
        });
      },
      resetNodeOverrides: (nodeId) => {
        const { [nodeId]: _removed, ...rest } = get().overrides;
        set({ overrides: rest });
      },
      hasNodeOverrides: (nodeId) => {
        const entry = get().overrides[nodeId];
        return Boolean(entry && Object.keys(entry).length > 0);
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ overrides: state.overrides }),
      merge: (persisted, current) => ({
        ...current,
        overrides: normalizeOverridesMap(
          (persisted as Partial<PracticeNodeOverridesState> | undefined)?.overrides ?? {},
        ),
      }),
    },
  ),
);

/** Sync accessor for non-React code paths. */
export function getLocalNodeStageOverrides(nodeId: string): NodeStageOverrides | null {
  const entry = usePracticeNodeOverridesStore.getState().overrides[nodeId];
  if (!entry || Object.keys(entry).length === 0) return null;
  return entry;
}
