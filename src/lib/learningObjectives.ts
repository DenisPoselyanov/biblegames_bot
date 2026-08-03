import type { LearningObjectiveId } from '../types';

/**
 * Stable id for a leaf topic node — the unit used by canonical learning and
 * reviewed content workflows (see docs/phases/PHASE_3_* and PHASE_4_*).
 * Deterministic from existing ids; no data migration is required.
 */
export function getLearningObjectiveId(themeId: string, nodeId: string): LearningObjectiveId {
  return `${themeId}:${nodeId}`;
}
