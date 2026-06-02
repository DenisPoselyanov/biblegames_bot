#!/usr/bin/env node
/**
 * Вирівнювання кількості питань між підтемами одного рівня.
 *
 * npm run balance-questions -- --node geography-sub-1 --dry-run
 * npm run balance-questions -- --theme geography --scope leaves --practice-ready
 * npm run balance-questions -- --node geography-sub-1 --scope leaves --difficulty youth
 *
 * practice-ready: ціль на підтему × складність (як fill-practice-nodes).
 */

import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DIFFICULTIES, THEME_IDS, loadTopicHierarchy, findNodeById } from './lib/themes-config.mjs';
import {
  applyAiCliFlags,
  checkLLM,
  defaultAiOpts,
  loadProjectEnv,
  providerLabel,
  unavailableHint,
} from './lib/llm.mjs';
import { loadThemeQuestions } from './lib/question-db.mjs';
import { countQuestionsForScope } from './lib/topic-question-counts.mjs';
import {
  PRACTICE_QUESTIONS_PER_STAGE,
  STAGE_COUNT_BY_DIFFICULTY,
  requiredQuestionsForDifficulty,
  stagesPossibleFromPool,
} from './lib/practice-config.mjs';
import {
  generateForTheme,
} from './generate-questions-ai.mjs';
import { countNodePool } from './lib/topic-node-pool-stats.mjs';
import { assertSubtopicNodeId } from './lib/topic-context.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const REPORT_FILE = join(ROOT, 'data', 'question-balance-report.json');
loadProjectEnv();
const { provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL } = defaultAiOpts();

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    theme: null,
    node: null,
    scope: 'siblings',
    target: 0,
    difficulty: 'all',
    practiceReady: false,
    dryRun: false,
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--theme' && args[i + 1]) opts.theme = args[++i];
    else if (args[i] === '--node' && args[i + 1]) opts.node = args[++i];
    else if (args[i] === '--scope' && args[i + 1]) opts.scope = args[++i];
    else if (args[i] === '--target' && args[i + 1]) opts.target = parseInt(args[++i], 10);
    else if (args[i] === '--difficulty' && args[i + 1]) opts.difficulty = args[++i];
    else if (args[i] === '--practice-ready') opts.practiceReady = true;
    else if (args[i] === '--provider' && args[i + 1]) opts.provider = args[++i];
    else if (args[i] === '--model' && args[i + 1]) opts.model = args[++i];
    else if (args[i] === '--dry-run') opts.dryRun = true;
  }
  applyAiCliFlags(opts, args);

  if (!opts.theme && !opts.node) {
    console.error('❌ Вкажи --theme <id> або --node <nodeId>');
    process.exit(1);
  }

  if (!['siblings', 'leaves'].includes(opts.scope)) {
    console.error('❌ --scope має бути siblings або leaves');
    process.exit(1);
  }

  return opts;
}

function findNodeInAllHierarchies(nodeId) {
  for (const fileId of [...THEME_IDS, 'topics-db']) {
    const root = loadTopicHierarchy(fileId);
    if (!root) continue;
    const node = findNodeById(root, nodeId);
    if (node) return { node, root, fileId };
  }
  return null;
}

function resolveAnchor(opts) {
  if (opts.node) {
    const found = findNodeInAllHierarchies(opts.node);
    if (!found) {
      console.error(`❌ Вузол "${opts.node}" не знайдено`);
      process.exit(1);
    }
    return found;
  }

  const themeId = opts.theme;
  const root = loadTopicHierarchy(themeId);
  if (!root) {
    console.error(`❌ Файл теми "${themeId}" не знайдено`);
    process.exit(1);
  }
  return { node: root, root, fileId: themeId };
}

function collectScopeNodes(anchorNode, scope) {
  if (scope === 'siblings') {
    return (anchorNode.children || []).filter(Boolean);
  }

  const leaves = [];
  function walk(n) {
    if (!n.children?.length) {
      leaves.push(n);
      return;
    }
    for (const c of n.children) walk(c);
  }
  walk(anchorNode);
  return leaves;
}

function resolveThemeIdForNode(node) {
  if (node.themeId && THEME_IDS.includes(node.themeId)) return node.themeId;
  if (node.aggregateThemeIds?.length) {
    const hit = node.aggregateThemeIds.find((id) => THEME_IDS.includes(id));
    if (hit) return hit;
  }
  return null;
}

function buildNodePath(root, targetId, path = []) {
  const current = [...path, root.title];
  if (root.id === targetId) return current;
  for (const child of root.children || []) {
    const result = buildNodePath(child, targetId, current);
    if (result) return result;
  }
  return null;
}

async function main() {
  const opts = parseArgs();
  const { node: anchorNode, root, fileId } = resolveAnchor(opts);
  const scopeNodes = collectScopeNodes(anchorNode, opts.scope);

  if (scopeNodes.length === 0) {
    console.error('❌ Немає підтем у обраному scope');
    process.exit(1);
  }

  const themeId =
    resolveThemeIdForNode(anchorNode) ||
    resolveThemeIdForNode(scopeNodes[0]) ||
    (THEME_IDS.includes(fileId) ? fileId : null);

  if (!themeId) {
    console.error('❌ Не вдалося визначити themeId для підрахунку питань');
    process.exit(1);
  }

  console.log('⚖️  Вирівнювання питань між підтемами');
  console.log('====================================');
  console.log(`Якір: ${anchorNode.title} (${anchorNode.id})`);
  console.log(`Scope: ${opts.scope} (${scopeNodes.length} вузлів)`);
  console.log(`Тема БД: ${themeId}`);
  console.log('');

  const questions = loadThemeQuestions(themeId);
  const { counts, untagged, totalQuestions } = countQuestionsForScope(
    scopeNodes,
    root,
    themeId,
    questions,
  );
  const autoTarget = Math.max(...scopeNodes.map((n) => counts[n.id] || 0), 0);

  if (untagged > 0 && totalQuestions > 0 && untagged / totalQuestions > 0.3) {
    console.warn(`⚠️  ${untagged} питань без topicNodeId — npm run prune-untagged`);
    console.warn('');
  }

  const difficulties =
    opts.practiceReady && opts.difficulty === 'all'
      ? [...DIFFICULTIES]
      : opts.difficulty !== 'all' && DIFFICULTIES.includes(opts.difficulty)
        ? [opts.difficulty]
        : opts.practiceReady
          ? ['youth']
          : [null];

  const rows = [];
  for (const node of scopeNodes) {
    for (const diff of difficulties) {
      const before = diff
        ? countNodePool(node.id, root, themeId, diff)
        : (countQuestionsForScope([node], root, themeId, questions).counts[node.id] || 0);

      let target = opts.target > 0 ? opts.target : autoTarget;
      if (opts.practiceReady && diff) {
        target = requiredQuestionsForDifficulty(diff);
      }

      const gap = Math.max(0, target - before);
      rows.push({
        nodeId: node.id,
        title: node.title,
        difficulty: diff,
        before,
        target,
        gap,
        generated: 0,
      });
    }
  }

  let practiceTarget = autoTarget;
  if (opts.practiceReady) {
    const diff = difficulties[0] ?? 'youth';
    practiceTarget = requiredQuestionsForDifficulty(diff);
    console.log(
      `Режим practice-ready: ціль ${practiceTarget} на підтему × складність (${difficulties.length} рівнів)\n`,
    );
  }

  const stageCol = opts.practiceReady ? 'Етапи'.padStart(6) : null;
  console.log(
    'Підтема'.padEnd(28),
    'Складн.'.padEnd(10),
    'Зараз'.padStart(6),
    'Ціль'.padStart(6),
    '+'.padStart(6),
    ...(stageCol ? [stageCol] : []),
  );
  console.log('-'.repeat(opts.practiceReady ? 70 : 58));
  for (const r of rows) {
    const stagesHint = opts.practiceReady
      ? String(stagesPossibleFromPool(r.before)).padStart(6)
      : null;
    console.log(
      r.title.slice(0, 26).padEnd(28),
      String(r.difficulty ?? '—').padEnd(10),
      String(r.before).padStart(6),
      String(r.target).padStart(6),
      String(r.gap).padStart(6),
      ...(stagesHint != null ? [stagesHint] : []),
    );
  }
  console.log('');

  const report = {
    generatedAt: new Date().toISOString(),
    anchorId: anchorNode.id,
    scope: opts.scope,
    themeId,
    target: practiceTarget,
    untaggedCount: untagged,
    rows,
    dryRun: opts.dryRun,
  };

  if (opts.dryRun) {
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');
    console.log(`📄 Превʼю збережено: ${REPORT_FILE}`);
    console.log('✅ Dry-run — генерація не запускалась');
    return;
  }

  const toGenerate = rows.filter((r) => r.gap > 0);
  if (toGenerate.length === 0) {
    console.log('✅ Усі підтеми вже на цільовому рівні');
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');
    return;
  }

  console.log(`🔗 Перевірка ${providerLabel(opts.provider)}...`);
  try {
    const ok = await checkLLM(opts.model, { provider: opts.provider });
    if (!ok) throw new Error('порожня відповідь');
    console.log(`✅ ${providerLabel(opts.provider)} працює\n`);
  } catch (e) {
    console.error('❌', e.message);
    console.error(`💡 ${unavailableHint(opts.provider)}`);
    process.exit(1);
  }

  let totalGenerated = 0;

  for (const row of toGenerate) {
    const node = findNodeById(root, row.nodeId);
    if (!node) continue;

    const path = buildNodePath(root, row.nodeId, []) || [node.title];
    const context = {
      title: node.title,
      description: node.description || '',
      path,
    };

    assertSubtopicNodeId(row.nodeId);

    const diff = row.difficulty ?? (opts.difficulty !== 'all' ? opts.difficulty : 'youth');
    console.log(`\n📝 ${node.title} / ${diff}: +${row.gap} питань`);
    const generated = await generateForTheme(
      themeId,
      row.gap,
      diff,
      opts.model,
      opts.provider,
      path,
      row.nodeId,
      context,
      [diff],
    );
    row.generated = generated;
    totalGenerated += generated;
  }

  report.rows = rows;
  report.totalGenerated = totalGenerated;
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n====================================');
  console.log(`✅ Додано питань: ${totalGenerated}`);
  console.log(`📄 Звіт: ${REPORT_FILE}`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
