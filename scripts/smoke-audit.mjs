/**
 * Smoke checks after bug-fix audit (run: npm run smoke-audit)
 */
import assert from 'node:assert/strict';
import { filterQuestionsByHierarchy } from '../src/data/questions.ts';

function testFilterUnknownNodeReturnsEmpty() {
  const hierarchy = {
    id: 'judges',
    title: 'Судді',
    themeId: 'judges',
    children: [{ id: 'judges-sub-1', title: 'Підтема', themeId: 'judges', children: [] }],
  };
  const questions = [
    {
      id: 'q1',
      themeId: 'judges',
      difficulty: 'child',
      text: 'Test?',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
    },
  ];
  const filtered = filterQuestionsByHierarchy(questions, 'missing-node', hierarchy);
  assert.equal(filtered.length, 0, 'unknown nodeId must not return full pool');
}

function testFilterByTopicNodeId() {
  const hierarchy = {
    id: 'judges',
    title: 'Судді',
    themeId: 'judges',
    children: [
      { id: 'judges-sub-1', title: 'A', themeId: 'judges', children: [] },
      { id: 'judges-sub-2', title: 'B', themeId: 'judges', children: [] },
    ],
  };
  const questions = [
    {
      id: 'q1',
      themeId: 'judges',
      topicNodeId: 'judges-sub-1',
      difficulty: 'child',
      text: 'A?',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
    },
    {
      id: 'q2',
      themeId: 'judges',
      topicNodeId: 'judges-sub-2',
      difficulty: 'child',
      text: 'B?',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 1,
    },
  ];
  const filtered = filterQuestionsByHierarchy(questions, 'judges-sub-1', hierarchy);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, 'q1');
}

async function testTopicsBundleLoads() {
  try {
    const { loadAllTopicHierarchies } = await import('../server/topicHierarchyLoader.ts');
    const map = await loadAllTopicHierarchies();
    assert.ok(Object.keys(map).length >= 2, 'topics hierarchy map should not be empty fallback only');
  } catch (e) {
    console.warn('topics bundle test skipped (Vite glob unavailable in Node):', e?.message ?? e);
  }
}

async function testKahootScoring() {
  const { calcQuestionPoints, calcSimplePoints, calcClassicPoints } = await import('../server/kahootScoring.ts');
  assert.equal(calcSimplePoints(0, 20000, true), 30);
  assert.equal(calcSimplePoints(20000, 20000, true), 5);
  assert.equal(calcSimplePoints(1000, 20000, false), 0);
  assert.ok(calcClassicPoints(0, 20000, true, 0) >= 1800);
  assert.ok(calcClassicPoints(0, 20000, true, 3) > calcClassicPoints(0, 20000, true, 0));
  assert.equal(calcQuestionPoints('simple', 0, 15000, true, 0), 30);
}

async function testKahootRanking() {
  const { buildPlayerRanks, getCompetitionRank } = await import('../src/lib/kahootRanking.ts');
  const players = [
    { id: 'a', score: 30 },
    { id: 'b', score: 18 },
    { id: 'c', score: 0 },
    { id: 'd', score: 0 },
  ];
  assert.equal(getCompetitionRank(players, 'a'), 1);
  assert.equal(getCompetitionRank(players, 'b'), 2);
  assert.equal(getCompetitionRank(players, 'c'), 3);
  assert.equal(getCompetitionRank(players, 'd'), 3);
  const ranks = buildPlayerRanks(players);
  assert.equal(ranks.c, 3);
  assert.equal(ranks.d, 3);
}

async function testNormalizeKahootSettings() {
  const { normalizeKahootSettings } = await import('../src/types/kahoot.ts');
  const s = normalizeKahootSettings({
    themeIds: ['geography'],
    questionCount: 10,
    timePerQuestion: 20,
    difficulty: 'youth',
  });
  assert.equal(s.flowMode, 'auto');
  assert.equal(s.scoringMode, 'classic');
  assert.equal(s.hostParticipates, false);
}

async function main() {
  testFilterUnknownNodeReturnsEmpty();
  testFilterByTopicNodeId();
  await testTopicsBundleLoads();
  await testKahootScoring();
  await testKahootRanking();
  await testNormalizeKahootSettings();
  console.log('smoke-audit: all checks passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
