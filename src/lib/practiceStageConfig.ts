import practiceStageManifest from '../../data/practice-stage-config.json';
import {
  DIFFICULTIES,
  type Difficulty,
  type TopicNode,
} from '../types';
import { PRACTICE_QUESTIONS_PER_STAGE, STAGE_COUNT_BY_DIFFICULTY } from './practiceConstants';
import { MAX_STAGE_CAP } from './practiceStageSettings';
import { getLocalNodeStageOverrides } from '../stores/practiceNodeOverridesStore';
import { findNodeById } from '../data/topicDbLoader.shared';
import type { TopicHierarchyMap } from '../types';

export const DEFAULT_FALLBACK_BASE_STAGES = 2;

export function findNodeInHierarchies(
  hierarchies: TopicHierarchyMap | null | undefined,
  nodeId: string,
): TopicNode | null {
  if (!hierarchies) return null;
  for (const root of Object.values(hierarchies)) {
    const found = findNodeById(root, nodeId);
    if (found) return found;
  }
  return null;
}

export interface PracticeStageNodeEntry {
  biblicalRichness?: number;
  recommendedBaseStages?: number;
  reasoning?: string;
  stages: Partial<Record<Difficulty, number>>;
}

export interface PracticeStageConfigFile {
  version: number;
  generatedAt?: string;
  provider?: string;
  model?: string;
  nodes: Record<string, PracticeStageNodeEntry>;
}

const manifest = practiceStageManifest as PracticeStageConfigFile;

function buildFallbackStages(baseStages: number): Record<Difficulty, number> {
  const base = Math.max(1, Math.min(5, Math.round(baseStages)));
  const out = {} as Record<Difficulty, number>;
  let prev = base;
  for (const d of DIFFICULTIES) {
    const cap = MAX_STAGE_CAP;
    const v = Math.min(cap, prev, base);
    out[d] = v;
    prev = v;
  }
  return out;
}

function getOverrideStages(
  nodeId: string | null,
  options?: { hierarchyRoot?: TopicNode | null; hierarchies?: TopicHierarchyMap | null },
): Partial<Record<Difficulty, number>> | null {
  if (!nodeId) return null;

  const local = getLocalNodeStageOverrides(nodeId);
  if (local) return local;

  const node =
    (options?.hierarchyRoot ? findNodeById(options.hierarchyRoot, nodeId) : null)
    ?? findNodeInHierarchies(options?.hierarchies, nodeId);
  return node?.practiceStages ?? null;
}

export function getManifestNodeEntry(nodeId: string): PracticeStageNodeEntry | undefined {
  return manifest.nodes?.[nodeId];
}

export function getPracticeStageCount(
  nodeId: string | null,
  difficulty: Difficulty,
  options?: {
    hierarchyRoot?: TopicNode | null;
    hierarchies?: TopicHierarchyMap | null;
    fallbackBaseStages?: number;
  },
): number {
  const cap = MAX_STAGE_CAP;
  if (!nodeId) return cap;

  const override = getOverrideStages(nodeId, options);
  if (override?.[difficulty] != null) {
    const v = Math.round(override[difficulty]!);
    if (v >= 1) return Math.min(cap, v);
  }

  const entry = manifest.nodes?.[nodeId];
  const fromManifest = entry?.stages?.[difficulty];
  if (fromManifest != null) {
    const v = Math.round(fromManifest);
    if (v >= 1) return Math.min(cap, v);
  }

  const fallbackBase = options?.fallbackBaseStages ?? DEFAULT_FALLBACK_BASE_STAGES;
  const fallback = buildFallbackStages(fallbackBase);
  return Math.min(cap, fallback[difficulty]);
}

export function getTotalPracticeStagesForNode(
  nodeId: string | null,
  options?: {
    hierarchyRoot?: TopicNode | null;
    hierarchies?: TopicHierarchyMap | null;
    fallbackBaseStages?: number;
  },
): number {
  if (!nodeId) {
    return DIFFICULTIES.reduce((s, d) => s + STAGE_COUNT_BY_DIFFICULTY[d], 0);
  }
  return DIFFICULTIES.reduce(
    (sum, d) => sum + getPracticeStageCount(nodeId, d, options),
    0,
  );
}

export function requiredQuestionsForNode(
  nodeId: string | null,
  difficulty: Difficulty,
  options?: {
    hierarchyRoot?: TopicNode | null;
    hierarchies?: TopicHierarchyMap | null;
    fallbackBaseStages?: number;
  },
): number {
  return getPracticeStageCount(nodeId, difficulty, options) * PRACTICE_QUESTIONS_PER_STAGE;
}
