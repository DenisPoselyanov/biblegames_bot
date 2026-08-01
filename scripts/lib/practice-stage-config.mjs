/**
 * Runtime helpers for per-node practice stage counts (mirror of src/lib/practiceStageConfig.ts).
 */

import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DIFFICULTIES, findTopicNodeGlobally } from './themes-config.mjs';
import {
  PRACTICE_QUESTIONS_PER_STAGE,
  STAGE_COUNT_BY_DIFFICULTY,
} from './practice-config.mjs';
import {
  buildFallbackStages,
  DEFAULT_FALLBACK_BASE_STAGES,
} from './practice-stage-prompt.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
export const PRACTICE_STAGE_CONFIG_PATH = join(ROOT, 'data/practice-stage-config.json');

let cachedConfig = null;

export function loadPracticeStageConfig(force = false) {
  if (cachedConfig && !force) return cachedConfig;
  if (!fs.existsSync(PRACTICE_STAGE_CONFIG_PATH)) {
    cachedConfig = { version: 1, nodes: {} };
    return cachedConfig;
  }
  try {
    cachedConfig = JSON.parse(fs.readFileSync(PRACTICE_STAGE_CONFIG_PATH, 'utf8'));
  } catch {
    cachedConfig = { version: 1, nodes: {} };
  }
  if (!cachedConfig.nodes) cachedConfig.nodes = {};
  return cachedConfig;
}

export function savePracticeStageConfig(config) {
  fs.writeFileSync(PRACTICE_STAGE_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  cachedConfig = config;
}

function getNodeOverrideStages(nodeId) {
  const hit = findTopicNodeGlobally(nodeId);
  const override = hit?.node?.practiceStages;
  if (!override || typeof override !== 'object') return null;
  return override;
}

export function getManifestNodeEntry(nodeId) {
  const config = loadPracticeStageConfig();
  return config.nodes?.[nodeId] ?? null;
}

export function getPracticeStageCount(nodeId, difficulty, options = {}) {
  const cap = STAGE_COUNT_BY_DIFFICULTY[difficulty] ?? 5;
  if (!nodeId) return cap;

  const override = getNodeOverrideStages(nodeId);
  if (override?.[difficulty] != null) {
    const v = Math.round(Number(override[difficulty]));
    if (Number.isFinite(v) && v >= 1) return Math.min(cap, v);
  }

  const entry = options.manifestEntry ?? getManifestNodeEntry(nodeId);
  const fromManifest = entry?.stages?.[difficulty];
  if (fromManifest != null) {
    const v = Math.round(Number(fromManifest));
    if (Number.isFinite(v) && v >= 1) return Math.min(cap, v);
  }

  const fallbackBase = options.fallbackBaseStages ?? DEFAULT_FALLBACK_BASE_STAGES;
  const fallback = buildFallbackStages(fallbackBase);
  return Math.min(cap, fallback[difficulty] ?? fallbackBase);
}

export function getTotalPracticeStagesForNode(nodeId, options = {}) {
  if (!nodeId) {
    return DIFFICULTIES.reduce((s, d) => s + (STAGE_COUNT_BY_DIFFICULTY[d] ?? 0), 0);
  }
  return DIFFICULTIES.reduce(
    (sum, d) => sum + getPracticeStageCount(nodeId, d, options),
    0,
  );
}

export function requiredQuestionsForNode(nodeId, difficulty, options = {}) {
  const stages = getPracticeStageCount(nodeId, difficulty, options);
  return stages * PRACTICE_QUESTIONS_PER_STAGE;
}

export function requiredQuestionsForDifficulty(difficulty, nodeId = null, options = {}) {
  if (nodeId) return requiredQuestionsForNode(nodeId, difficulty, options);
  const stages = STAGE_COUNT_BY_DIFFICULTY[difficulty] ?? 5;
  return stages * PRACTICE_QUESTIONS_PER_STAGE;
}

export function isPracticeReady(poolSize, difficulty, nodeId = null, options = {}) {
  const required = requiredQuestionsForDifficulty(difficulty, nodeId, options);
  return poolSize >= required;
}

export function practiceGap(poolSize, difficulty, nodeId = null, options = {}) {
  const required = requiredQuestionsForDifficulty(difficulty, nodeId, options);
  return Math.max(0, required - poolSize);
}
