import type { LearningObjectiveId } from '../types';

/**
 * Stable id for a leaf topic node — the unit AI content (Phase 10, see
 * docs/product-rebuild/AI_SYSTEM_REBUILD_ROADMAP.md) will target via
 * `learningObjectiveId`. Deterministic from existing ids, no data migration.
 */
export function getLearningObjectiveId(themeId: string, nodeId: string): LearningObjectiveId {
  return `${themeId}:${nodeId}`;
}
