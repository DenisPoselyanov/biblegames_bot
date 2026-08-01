#!/usr/bin/env node
/**
 * Import per-difficulty practice stage counts from data/practice-stages-list.txt
 * into data/practice-stage-config.json.
 *
 * npm run import-practice-stages-list
 * npm run import-practice-stages-list -- --dry-run
 */

import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { collectAllLeafNodes } from './lib/topic-node-pool-stats.mjs';
import { DIFFICULTIES, THEMES } from './lib/themes-config.mjs';
import {
  loadPracticeStageConfig,
  savePracticeStageConfig,
  PRACTICE_STAGE_CONFIG_PATH,
} from './lib/practice-stage-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LIST_FILE = join(ROOT, 'data/practice-stages-list.txt');

/** Section headers in practice-stages-list.txt → theme id */
const SECTION_ALIASES = {
  'Десять заповідей': 'commandments',
  'Дії апостолів': 'acts',
};

const SECTION_TO_THEME = {
  ...Object.fromEntries(THEMES.map((t) => [t.title, t.id])),
  ...SECTION_ALIASES,
};

/** List title → topics-db leaf title when spelling differs */
const TITLE_ALIASES = {
  'general-epistles\0Первосвященик за порядком Мелхіседека':
    'Первосвященник за порядком Мелхіседека',
};

function resolveListTitle(themeId, title) {
  return TITLE_ALIASES[`${themeId}\0${title}`] ?? title;
}

const STAGES_LINE_RE = /^(.+?)\s+(\d+(?:\/\d+){6})\s*$/;

function parseArgs() {
  return { dryRun: process.argv.includes('--dry-run') };
}

function parseStagesSlashed(raw) {
  const parts = raw.split('/').map((s) => parseInt(s, 10));
  if (parts.length !== DIFFICULTIES.length || parts.some((n) => !Number.isFinite(n) || n < 1)) {
    throw new Error(`Невірний формат етапів: ${raw}`);
  }
  const stages = {};
  DIFFICULTIES.forEach((d, i) => {
    stages[d] = parts[i];
  });
  return stages;
}

function parseListFile(content) {
  const entries = [];
  let currentThemeId = null;

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('# ') || trimmed === '#') continue;

    if (trimmed.startsWith('## ')) continue;

    if (trimmed.startsWith('### ')) {
      const sectionTitle = trimmed.slice(4).trim();
      currentThemeId = SECTION_TO_THEME[sectionTitle] ?? null;
      if (!currentThemeId) {
        throw new Error(`Невідома секція: ${sectionTitle}`);
      }
      continue;
    }

    const match = trimmed.match(STAGES_LINE_RE);
    if (!match) {
      throw new Error(`Не вдалося розпарсити рядок: ${trimmed}`);
    }
    if (!currentThemeId) {
      throw new Error(`Рядок поза секцією: ${trimmed}`);
    }

    entries.push({
      themeId: currentThemeId,
      title: match[1].trim(),
      stages: parseStagesSlashed(match[2]),
    });
  }

  return entries;
}

function buildLeafIndex() {
  const byThemeTitle = new Map();
  const byTitle = new Map();

  for (const leaf of collectAllLeafNodes()) {
    const key = `${leaf.themeId}\0${leaf.title}`;
    byThemeTitle.set(key, leaf);

    const existing = byTitle.get(leaf.title) ?? [];
    existing.push(leaf);
    byTitle.set(leaf.title, existing);
  }

  return { byThemeTitle, byTitle };
}

function recommendedBaseFromStages(stages) {
  return Math.max(...DIFFICULTIES.map((d) => stages[d] ?? 1));
}

function main() {
  const opts = parseArgs();
  if (!fs.existsSync(LIST_FILE)) {
    throw new Error(`Файл не знайдено: ${LIST_FILE}`);
  }

  const listEntries = parseListFile(fs.readFileSync(LIST_FILE, 'utf8'));
  const { byThemeTitle, byTitle } = buildLeafIndex();
  const config = loadPracticeStageConfig(true);

  const unmatched = [];
  const updated = [];
  const skippedDuplicateTitle = [];

  for (const entry of listEntries) {
    const resolvedTitle = resolveListTitle(entry.themeId, entry.title);
    const key = `${entry.themeId}\0${resolvedTitle}`;
    let leaf = byThemeTitle.get(key);

    if (!leaf) {
      const candidates = (byTitle.get(resolvedTitle) ?? []).filter((l) => l.themeId === entry.themeId);
      if (candidates.length === 1) leaf = candidates[0];
      else if (candidates.length > 1) {
        skippedDuplicateTitle.push({ ...entry, nodeIds: candidates.map((c) => c.nodeId) });
        continue;
      }
    }

    if (!leaf) {
      unmatched.push(entry);
      continue;
    }

    const base = recommendedBaseFromStages(entry.stages);
    const nodeEntry = {
      biblicalRichness: Math.min(5, base),
      recommendedBaseStages: Math.min(5, base),
      reasoning: 'Імпорт з practice-stages-list.txt',
      stages: entry.stages,
    };

    if (!opts.dryRun) {
      config.nodes[leaf.nodeId] = nodeEntry;
    }

    updated.push({
      nodeId: leaf.nodeId,
      themeId: entry.themeId,
      title: entry.title,
      stages: entry.stages,
    });
  }

  if (!opts.dryRun) {
    savePracticeStageConfig({
      ...config,
      version: 1,
      generatedAt: new Date().toISOString(),
      provider: 'practice-stages-list',
      model: 'manual',
    });
  }

  console.log(`Файл: ${LIST_FILE}`);
  console.log(`Manifest: ${PRACTICE_STAGE_CONFIG_PATH}`);
  console.log(`Рядків у списку: ${listEntries.length}`);
  console.log(`${opts.dryRun ? 'Буде оновлено' : 'Оновлено'}: ${updated.length}`);

  if (unmatched.length) {
    console.warn(`\n⚠ Не знайдено в topics-db (${unmatched.length}):`);
    for (const u of unmatched) {
      console.warn(`  [${u.themeId}] ${u.title}`);
    }
  }

  if (skippedDuplicateTitle.length) {
    console.warn(`\n⚠ Дублікати назви в темі (${skippedDuplicateTitle.length}):`);
    for (const u of skippedDuplicateTitle) {
      console.warn(`  [${u.themeId}] ${u.title}: ${u.nodeIds.join(', ')}`);
    }
  }

  const updatedIds = new Set(updated.map((u) => u.nodeId));
  const allLeaves = collectAllLeafNodes();
  const missingInList = allLeaves.filter((l) => !updatedIds.has(l.nodeId));
  if (missingInList.length) {
    console.warn(`\n⚠ Листів без рядка в списку (${missingInList.length}):`);
    for (const l of missingInList.slice(0, 20)) {
      console.warn(`  [${l.themeId}] ${l.title} (${l.nodeId})`);
    }
    if (missingInList.length > 20) {
      console.warn(`  … і ще ${missingInList.length - 20}`);
    }
  }

  if (opts.dryRun) {
    console.log('\nDry-run: файл не записано');
  } else if (unmatched.length || skippedDuplicateTitle.length) {
    process.exitCode = 1;
  }
}

main();
