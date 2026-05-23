#!/usr/bin/env node
/**
 * Аналіз якості та логічності ієрархії тем (Ollama topic trees)
 *
 * npm run analyze-topics
 *
 * Аналізує:
 * - Ширина теми (скільки потенційних питань можна згенерувати)
 * - Унікальність теми (чи перетинається з іншими)
 * - Глибина ієрархії
 * - Якість описів
 * - Валідність ID та зв'язків
 * - Покриття тем
 */

import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  THEMES,
  THEME_IDS,
  GROUPS,
  getTheme,
  loadTopicHierarchy,
  flattenTopicNodes,
  findNodeById,
} from './lib/themes-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOPICS_DIR = join(__dirname, '..', 'data', 'topics-db');
const REPORT_FILE = join(__dirname, '..', 'data', 'topics-quality-report.json');

// ===== NORMALIZATION =====

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\sа-яґєії]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function jaccardSimilarity(words1, words2) {
  if (words1.length === 0 || words2.length === 0) return 0;
  const intersection = words1.filter((w) => words2.includes(w));
  const union = [...new Set([...words1, ...words2])];
  return intersection.length / union.length;
}

// ===== КАНОНІЧНА ВАЖЛИВІСТЬ =====

const CANONICAL_IMPORTANCE = {
  'євангелі': 60,
  'псалм': 55,
  'пророк': 50,
  'павло': 45,
  'завіт': 40,
  'закон': 35,
  'цар': 30,
  'ісус': 30,
  'притч': 25,
  'чудо': 25,
  'відкрит': 25,
  'бутт': 25,
  'виход': 25,
  'повтор': 25,
  'географ': 20,
  'патріарх': 20,
  'судд': 20,
  'заповід': 20,
  'самуїл': 25,
  'даниїл': 20,
  'єзек': 20,
  'іса': 20,
  'єрем': 20,
  'ерем': 20,
  'марк': 20,
  'лук': 20,
  'іван': 20,
  'матв': 20,
  'молит': 15,
};

const KEY_INDICATORS = [
  'цар', 'пророк', 'апостол', 'книг', 'писан', 'заповід',
  'закон', 'жертв', 'свят', 'чудо', 'зцілен', 'воскрес',
  'народ', 'земл', 'міст', 'річк', 'гор', 'пустел',
  'війн', 'битв', 'суд', 'полон', 'храм', 'скині',
  'псалм', 'пісн', 'молит', 'благослов', 'проклят',
  'род', 'плем', 'колін', 'син', 'доньк', 'батьк',
  'подорож', 'місі', 'проповід', 'навчан', 'притч',
];

// ===== ШИРИНА ТЕМИ =====

/**
 * Оцінює, наскільки тема "широка" для генерації питань.
 * Високий бал — тема багатогранна, можна згенерувати багато питань.
 * Низький бал — тема надто вузька.
 */
function calculateBreadth(node) {
  let score = 0;
  const title = node.title || '';
  const desc = node.description || '';
  const titleLower = title.toLowerCase();
  const descLower = desc.toLowerCase();

  // 1. Канонічна важливість (0-60)
  let canonicalScore = 0;
  for (const [keyword, weight] of Object.entries(CANONICAL_IMPORTANCE)) {
    if (titleLower.includes(keyword)) {
      canonicalScore = Math.max(canonicalScore, weight);
    }
  }
  score += canonicalScore;

  // 2. Ієрархічна ширина (0-25)
  const children = node.children || [];
  const childScore = Math.min(children.length * 5, 15);
  const allNodes = flattenTopicNodes(node);
  const descendantScore = Math.min(Math.floor(Math.sqrt(allNodes.length)) * 4, 8);
  const depth = maxNodeDepth(node);
  const depthScore = Math.min(depth * 3, 5);
  score += childScore + descendantScore + depthScore;

  // 3. Багатство опису (0-15)
  const descWords = desc.split(/\s+/).filter(Boolean);
  const wordScore = Math.min(Math.floor(descWords.length / 2), 7);
  let indicatorCount = 0;
  for (const ki of KEY_INDICATORS) {
    if (descLower.includes(ki)) indicatorCount++;
  }
  score += wordScore + Math.min(indicatorCount, 8);

  // 4. Контекст групи/агрегації (0-10)
  if (node.aggregateThemeIds && node.aggregateThemeIds.length > 1) {
    score += 10;
  } else if (node.themeId) {
    score += 5;
  }

  return Math.min(score, 100);
}

function maxNodeDepth(node, depth = 1) {
  if (!node.children || node.children.length === 0) return depth;
  let max = depth;
  for (const child of node.children) {
    const d = maxNodeDepth(child, depth + 1);
    if (d > max) max = d;
  }
  return max;
}

// ===== УНІКАЛЬНІСТЬ ТЕМИ =====

/**
 * Порівнює тему з іншими темами за схожістю описів.
 * Якщо дві теми мають схожість > 40% — вони потенційно перетинаються.
 */
function checkUniqueness(node, allNodes) {
  const nodeWords = normalizeText(`${node.title} ${node.description}`);

  const overlaps = [];
  for (const other of allNodes) {
    if (other.node.id === node.id) continue;
    const otherWords = normalizeText(`${other.node.title} ${other.node.description}`);
    const similarity = jaccardSimilarity(nodeWords, otherWords);

    if (similarity > 0.4) {
      overlaps.push({
        otherId: other.node.id,
        otherTitle: other.node.title,
        similarity: Math.round(similarity * 100),
      });
    }
  }

  overlaps.sort((a, b) => b.similarity - a.similarity);
  return overlaps.slice(0, 5);
}

// ===== ВАЛІДАЦІЯ ID =====

function validateIds(nodes) {
  const ids = new Map();
  const issues = [];

  for (const { node, depth } of nodes) {
    if (!node.id) {
      issues.push({ node: node.title, issue: `Відсутній id (глибина ${depth})` });
      continue;
    }
    if (ids.has(node.id)) {
      issues.push({ node: node.title, issue: `Дублікат id: ${node.id} (також у "${ids.get(node.id)}")` });
    }
    ids.set(node.id, node.title);

    // Перевірка: якщо є themeId — чи існує така тема
    if (node.themeId && !THEME_IDS.includes(node.themeId)) {
      issues.push({ node: node.title, issue: `Невідомий themeId: ${node.themeId}` });
    }

    // Перевірка aggregateThemeIds
    if (node.aggregateThemeIds && !Array.isArray(node.aggregateThemeIds)) {
      issues.push({ node: node.title, issue: `aggregateThemeIds не є масивом` });
    }
    if (node.aggregateThemeIds && node.aggregateThemeIds.length === 0) {
      issues.push({ node: node.title, issue: `aggregateThemeIds порожній` });
    }
  }

  return { totalIds: ids.size, duplicateCount: issues.filter((i) => i.issue.includes('Дублікат')).length, issues };
}

// ===== ЯКІСТЬ ОПИСУ =====

function evaluateDescriptionQuality(nodes) {
  const results = [];

  for (const { node, depth } of nodes) {
    const desc = node.description || '';
    const words = desc.split(/\s+/).filter(Boolean);
    let score = 0;
    let notes = [];

    if (words.length >= 10) { score += 30; }
    else if (words.length >= 5) { score += 15; notes.push('Короткий опис'); }
    else if (words.length >= 2) { score += 5; notes.push('Занадто короткий опис'); }
    else { notes.push('Опис відсутній'); }

    if (!desc.endsWith('.') && desc.length > 0) notes.push('Немає крапки в кінці');

    if (node.icon && node.icon !== '📖') score += 10;
    else notes.push('Стандартна іконка 📖');

    if (depth === 0) {
      score += 10; // Кореневий вузол має опис за замовчуванням
    }

    const hasBibleRef = /[1-5]?\s*[А-Яа-яґєії]{2,}\./.test(desc);
    if (hasBibleRef) score += 15;

    results.push({
      id: node.id,
      title: node.title,
      depth,
      score: Math.min(score, 100),
      wordCount: words.length,
      notes,
    });
  }

  return results;
}

// ===== ПОКРИТТЯ ТЕМ =====

function calculateCoverage() {
  const existingFiles = fs.existsSync(TOPICS_DIR)
    ? fs.readdirSync(TOPICS_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''))
    : [];

  const groupFiles = GROUPS.map((g) => g.id);
  const themeFiles = THEME_IDS.filter((t) => existingFiles.includes(t));
  const missingThemes = THEME_IDS.filter((t) => !existingFiles.includes(t));
  const extraFiles = existingFiles.filter((f) => !groupFiles.includes(f) && !THEME_IDS.includes(f));

  return {
    totalFiles: existingFiles.length,
    groupFiles: groupFiles.filter((g) => existingFiles.includes(g)),
    themeFiles,
    missingThemes,
    extraFiles,
    coverage: THEME_IDS.length > 0
      ? Math.round((themeFiles.length / THEME_IDS.length) * 100)
      : 0,
  };
}

// ===== ЛОГІЧНА ЦІЛІСНІСТЬ =====

function checkLogicalConsistency(root) {
  const issues = [];

  function traverse(node, parentId, path) {
    if (!node.children || !Array.isArray(node.children)) {
      issues.push({ node: node.title, id: node.id, issue: 'children не є масивом' });
      return;
    }

    for (const child of node.children) {
      if (!child.id) {
        issues.push({ node: child.title, issue: `Дочірній вузол без id у "${node.title}"` });
      }

      // Перевірка циклічних посилань
      if (path.includes(child.id)) {
        issues.push({ node: child.title, id: child.id, issue: 'Циклічне посилання' });
        continue;
      }

      traverse(child, node.id, [...path, child.id]);
    }
  }

  traverse(root, null, [root.id]);
  return issues;
}

// ===== ОСНОВНА ЛОГІКА =====

function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {},
    breadth: [],
    uniqueness: [],
    quality: [],
    ids: {},
    coverage: {},
    consistency: [],
    recommendations: [],
  };

  console.log('📊 Аналіз якості та логічності ієрархії тем');
  console.log('============================================\n');

  // Завантажуємо всі файли
  const allHierarchies = {};
  const allFiles = fs.existsSync(TOPICS_DIR)
    ? fs.readdirSync(TOPICS_DIR).filter((f) => f.endsWith('.json'))
    : [];

  for (const file of allFiles) {
    const fileId = file.replace('.json', '');
    const root = loadTopicHierarchy(fileId);
    if (root) {
      allHierarchies[fileId] = root;
    }
  }

  // Всі вузли для аналізу
  const allNodes = [];
  const allTopicNodes = [];

  for (const [fileId, root] of Object.entries(allHierarchies)) {
    const nodes = flattenTopicNodes(root);
    for (const entry of nodes) {
      allNodes.push(entry);
      // Тільки тематичні вузли (не кореневі файли)
      if (entry.depth > 0) {
        allTopicNodes.push(entry);
      }
    }
  }

  // Валідація ID
  console.log('🔍 Валідація ID...');
  const idResult = validateIds(allNodes);
  report.ids = {
    total: idResult.totalIds,
    duplicates: idResult.duplicateCount,
    issues: idResult.issues,
  };
  console.log(`   Всього вузлів: ${idResult.totalIds}`);
  console.log(`   Дублікатів ID: ${idResult.duplicateCount}`);
  if (idResult.issues.length > 0) {
    console.log('   Проблеми:');
    for (const iss of idResult.issues.slice(0, 10)) {
      console.log(`     ⚠️  ${iss.node}: ${iss.issue}`);
    }
    if (idResult.issues.length > 10) {
      console.log(`     ... і ще ${idResult.issues.length - 10}`);
    }
  }
  console.log('');

  // Якість описів
  console.log('📝 Оцінка якості описів...');
  const qualityResults = evaluateDescriptionQuality(allNodes);
  report.quality = qualityResults;

  const avgQuality = qualityResults.length > 0
    ? Math.round(qualityResults.reduce((s, r) => s + r.score, 0) / qualityResults.length)
    : 0;
  const poorDescNodes = qualityResults.filter((r) => r.score < 40);
  console.log(`   Середня оцінка описів: ${avgQuality}/100`);
  console.log(`   Вузли з поганим описом: ${poorDescNodes.length}/${qualityResults.length}`);
  if (poorDescNodes.length > 0) {
    console.log('   Найгірші:');
    for (const r of poorDescNodes.slice(0, 5)) {
      console.log(`     ⚠️  [${r.depth}] ${r.title}: ${r.score}/100 — ${r.notes.join(', ')}`);
    }
  }
  console.log('');

  // Покриття
  console.log('🌐 Покриття тем...');
  const coverage = calculateCoverage();
  report.coverage = coverage;
  console.log(`   Файлів ієрархій: ${coverage.totalFiles}`);
  console.log(`   Покриття тем: ${coverage.coverage}% (${coverage.themeFiles.length}/${THEME_IDS.length})`);
  if (coverage.missingThemes.length > 0) {
    report.recommendations.push(`Додати topic-файли для: ${coverage.missingThemes.join(', ')}`);
    console.log(`   ❌ Відсутні теми: ${coverage.missingThemes.join(', ')}`);
  }
  if (coverage.extraFiles.length > 0) {
    console.log(`   📎 Додаткові файли: ${coverage.extraFiles.join(', ')}`);
  }
  console.log('');

  // Логічна цілісність
  console.log('🔗 Перевірка логічної цілісності...');
  report.consistency = [];
  for (const [fileId, root] of Object.entries(allHierarchies)) {
    const issues = checkLogicalConsistency(root);
    if (issues.length > 0) {
      report.consistency.push({ file: fileId, issues });
      console.log(`   ⚠️  ${fileId}: ${issues.length} проблем`);
      for (const iss of issues) {
        console.log(`     - ${iss.node}: ${iss.issue}`);
      }
    }
  }
  if (report.consistency.length === 0) {
    console.log('   ✅ Всі файли логічно цілісні');
  }
  console.log('');

  // Ширина тем
  console.log('📏 Аналіз ширини тем (потенціал для питань)...');
  const breadthResults = [];

  for (const { node, depth } of allTopicNodes) {
    const score = calculateBreadth(node);
    breadthResults.push({
      id: node.id,
      title: node.title,
      depth,
      breadthScore: score,
      childCount: (node.children || []).length,
      totalDescendants: flattenTopicNodes(node).length,
    });
  }

  breadthResults.sort((a, b) => a.breadthScore - b.breadthScore);
  report.breadth = breadthResults;

  const narrowTopics = breadthResults.filter((r) => r.breadthScore < 30);
  const wideTopics = breadthResults.filter((r) => r.breadthScore >= 60);

  console.log(`   Всього підтем: ${breadthResults.length}`);
  console.log(`   Вузькі теми (потрібно розширити): ${narrowTopics.length}`);
  console.log(`   Широкі теми (гарний потенціал): ${wideTopics.length}`);

  if (narrowTopics.length > 0) {
    console.log('\n   🔴 Теми з низьким потенціалом для питань (< 30 балів):');
    for (const t of narrowTopics) {
      console.log(`     ${'  '.repeat(t.depth)}⚠️  ${t.title} (${t.breadthScore}/100) — ${t.childCount} дітей, ${t.totalDescendants} вузлів`);
      report.recommendations.push(`Розширити тему "${t.title}" — додати більше підтем або покращити опис (поточний бал: ${t.breadthScore}/100)`);
    }
  }

  if (wideTopics.length > 0) {
    console.log('\n   🟢 Теми з високим потенціалом для питань (≥ 60 балів):');
    for (const t of wideTopics.slice(0, 10)) {
      console.log(`     ${'  '.repeat(t.depth)}✅ ${t.title} (${t.breadthScore}/100) — ${t.childCount} дітей`);
    }
    if (wideTopics.length > 10) {
      console.log(`     ... і ще ${wideTopics.length - 10} тем`);
    }
  }
  console.log('');

  // Унікальність тем
  console.log('🎯 Аналіз унікальності (перетин тем)...');
  const uniquenessResults = [];

  for (const { node } of allTopicNodes) {
    const overlaps = checkUniqueness(node, allTopicNodes);
    if (overlaps.length > 0) {
      uniquenessResults.push({
        id: node.id,
        title: node.title,
        overlaps,
      });
    }
  }

  uniquenessResults.sort((a, b) => b.overlaps.length - a.overlaps.length);
  report.uniqueness = uniquenessResults;

  const overlappingTopics = uniquenessResults.filter((r) => r.overlaps.length > 0);
  console.log(`   Потенційно перетинаються: ${overlappingTopics.length} тем`);
  if (overlappingTopics.length > 0) {
    console.log('   Найбільші перетини:');
    for (const r of overlappingTopics.slice(0, 5)) {
      for (const o of r.overlaps) {
        console.log(`     🔗 "${r.title}" ~ "${o.otherTitle}" (схожість ${o.similarity}%)`);
        report.recommendations.push(`Перевірити перетин: "${r.title}" та "${o.otherTitle}" (схожість ${o.similarity}%)`);
      }
    }
  }
  console.log('');

  // Summary
  const totalIssues =
    idResult.issues.length +
    report.consistency.reduce((s, c) => s + c.issues.length, 0) +
    narrowTopics.length;

  report.summary = {
    totalNodes: allNodes.length,
    totalTopicNodes: allTopicNodes.length,
    filesAnalyzed: Object.keys(allHierarchies).length,
    avgDescriptionQuality: avgQuality,
    coverage: coverage.coverage,
    narrowTopics: narrowTopics.length,
    wideTopics: wideTopics.length,
    overlappingTopics: overlappingTopics.length,
    totalIssues,
    recommendations: report.recommendations.length,
  };

  console.log('============================================');
  console.log('📊 ПІДСУМОК');
  console.log(`   Файлів проаналізовано: ${report.summary.filesAnalyzed}`);
  console.log(`   Всього вузлів: ${report.summary.totalNodes}`);
  console.log(`   Середня якість описів: ${report.summary.avgDescriptionQuality}/100`);
  console.log(`   Покриття тем: ${report.summary.coverage}%`);
  console.log(`   Вузьких тем: ${report.summary.narrowTopics}`);
  console.log(`   Широких тем: ${report.summary.wideTopics}`);
  console.log(`   Перетинається: ${report.summary.overlappingTopics}`);
  console.log(`   Всього проблем: ${report.summary.totalIssues}`);
  console.log(`   Рекомендацій: ${report.summary.recommendations}`);

  // Збереження звіту
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n📄 Звіт збережено: ${REPORT_FILE}`);
  console.log('\n✅ Аналіз завершено!');

  if (report.recommendations.length > 0) {
    console.log('\n💡 РЕКОМЕНДАЦІЇ:');
    report.recommendations.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
  }
}

main();
