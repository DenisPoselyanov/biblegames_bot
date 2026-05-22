import { useEffect, useMemo, useState } from 'react';

import { Link } from 'react-router-dom';
import { ALL_QUESTIONS } from '../data/questions';
import { loadAllAiQuestions } from '../data/questionDbLoader';
import { loadAllTopicHierarchies, flattenTopicNodes } from '../data/topicDbLoader';
import { THEMES } from '../data/themes';
import { DIFFICULTY_LABELS, type Difficulty, type TopicNode, type TopicHierarchyMap } from '../types';
import { questionQualityValidator } from '../lib/questionQuality';
import { questionQuarantineManager } from '../lib/questionQuarantine';
import { questionPoolManager } from '../lib/questionPools';
import styles from './AdminPanel.module.css';

type MainTab = 'topics' | 'questions';
type QuestionsSubTab = 'quarantine' | 'reports' | 'pools';
type SeverityFilter = 'all' | 'low' | 'medium' | 'high';

function themeLabel(themeId: string): string {
  return THEMES.find((t) => t.id === themeId)?.title ?? themeId;
}

function difficultyColor(d: Difficulty): string {
  const map: Record<Difficulty, string> = {
    baby: '#6a9',
    child: '#6a9',
    youth: '#ca3',
    student: '#e88',
    preacher: '#e55',
    teacher: '#c44',
    theologian: '#a33',
  };
  return map[d] || '#888';
}

function TopicTreeNode({ node, depth, questionsByTheme, allQuestions }: {
  node: TopicNode;
  depth: number;
  questionsByTheme: Record<string, number>;
  allQuestions: typeof ALL_QUESTIONS;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const questionCount = allQuestions.filter(q => q.themeId === node.id || q.themeId.startsWith(node.id.split('-')[0])).length;

  return (
    <li style={{ marginLeft: depth * 20 }}>
      <div
        style={{ cursor: (node.children?.length ?? 0) > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}
        onClick={() => (node.children?.length ?? 0) > 0 && setExpanded(!expanded)}
      >
        <span>{(node.children?.length ?? 0) > 0 ? (expanded ? '▼' : '▶') : '◈'}</span>
        <span>{node.icon}</span>
        <span style={{ fontWeight: depth === 0 ? 600 : 400 }}>{node.title}</span>
        <span style={{ fontSize: 12, color: '#888' }}>{questionCount} питань</span>
      </div>
      {expanded && (node.children?.length ?? 0) > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {(node.children ?? []).map((child) => (
            <TopicTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              questionsByTheme={questionsByTheme}
              allQuestions={allQuestions}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function AdminPanel() {
  const [mainTab, setMainTab] = useState<MainTab>('topics');
  const [subTab, setSubTab] = useState<QuestionsSubTab>('quarantine');
  const [version, setVersion] = useState(0);
  const [poolVersion, setPoolVersion] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [topicHierarchies, setTopicHierarchies] = useState<TopicHierarchyMap>({});
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);

  useEffect(() => {
    loadAllAiQuestions().then((aiQuestions) => {
      const all = [...ALL_QUESTIONS, ...aiQuestions];
      questionPoolManager.initializePools(all);
      setPoolVersion((v) => v + 1);
    });
    loadAllTopicHierarchies().then(setTopicHierarchies);
  }, []);

  const allQuestionsWithAi = useMemo(() => {
    const map = new Map<string, (typeof ALL_QUESTIONS)[number]>();
    for (const q of ALL_QUESTIONS) map.set(q.id, q);
    return map;
  }, []);

  const questionsByTheme = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of ALL_QUESTIONS) {
      counts[q.themeId] = (counts[q.themeId] || 0) + 1;
    }
    return counts;
  }, []);

  const quarantineList = useMemo(
    () => questionQuarantineManager.getAllQuarantined(),
    [version],
  );

  const qualityReports = useMemo(
    () => questionQuarantineManager.getAllQualityReports(),
    [version],
  );

  const quarantineStats = useMemo(
    () => questionQuarantineManager.getQuarantineStats(),
    [version],
  );

  const poolStats = useMemo(() => questionPoolManager.getPoolStats(), [poolVersion]);

  const handleValidateAll = () => {
    for (const q of ALL_QUESTIONS) {
      const report = questionQualityValidator.validateQuestion(q, ALL_QUESTIONS);
      questionQuarantineManager.saveQualityReport(report);
    }
    setVersion((v) => v + 1);
  };

  const handleApproveFix = (questionId: string) => {
    questionQuarantineManager.approveFix(questionId, 'admin');
    setVersion((v) => v + 1);
  };

  const handleReject = (questionId: string) => {
    questionQuarantineManager.rejectQuestion(questionId, 'admin');
    setVersion((v) => v + 1);
  };

  const handleRelease = (questionId: string) => {
    questionQuarantineManager.releaseFromQuarantine(questionId);
    setVersion((v) => v + 1);
  };

  const filteredReports = useMemo(() => {
    if (severityFilter === 'all') return qualityReports;
    return qualityReports.filter((r) =>
      r.issues.some((i) => i.severity === severityFilter),
    );
  }, [qualityReports, severityFilter]);

  const topicsThemes = useMemo(
    () => THEMES.filter((t) => topicHierarchies[t.id]),
    [topicHierarchies],
  );

  const selectedTopic = selectedThemeId ? topicHierarchies[selectedThemeId] : null;

  return (
    <section className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>Адмін-панель</h1>
        <Link to="/profile" className={styles.backBtn}>← Профіль</Link>
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tabBtn} ${mainTab === 'topics' ? styles.tabActive : ''}`}
          onClick={() => setMainTab('topics')}
        >
          🏷️ Теми ({Object.keys(topicHierarchies).length})
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${mainTab === 'questions' ? styles.tabActive : ''}`}
          onClick={() => setMainTab('questions')}
        >
          ❓ Запитання
        </button>
      </div>

      {mainTab === 'topics' && (
        <div className={styles.tabContent}>
          <div className={styles.statsRow}>
            <span className={styles.stat}>Тем: {topicsThemes.length}</span>
            <span className={styles.stat}>Всього питань: {ALL_QUESTIONS.length}</span>
          </div>

          <div className={styles.filterRow}>
            <span className={styles.muted}>Категорія:</span>
            <button
              type="button"
              className={`${styles.miniBtn} ${!selectedThemeId ? styles.miniBtnActive : ''}`}
              onClick={() => setSelectedThemeId(null)}
            >
              Всі
            </button>
            {topicsThemes.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`${styles.miniBtn} ${selectedThemeId === t.id ? styles.miniBtnActive : ''}`}
                onClick={() => setSelectedThemeId(t.id)}
              >
                {t.icon} {t.title}
              </button>
            ))}
          </div>

          {selectedTopic ? (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <TopicTreeNode
                node={selectedTopic}
                depth={0}
                questionsByTheme={questionsByTheme}
                allQuestions={ALL_QUESTIONS}
              />
            </ul>
          ) : (
            <div className={styles.themeGrid}>
              {topicsThemes.map((t) => {
                const hierarchy = topicHierarchies[t.id];
                const totalCount = questionsByTheme[t.id] ?? 0;
                const flatNodes = hierarchy ? flattenTopicNodes(hierarchy) : [];
                return (
                  <div
                    key={t.id}
                    className={styles.poolCard}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedThemeId(t.id)}
                  >
                    <h3>{t.icon} {t.title}</h3>
                    <p className={styles.poolCount}>{totalCount} питань</p>
                    <p className={styles.muted}>
                      {flatNodes.length} вузлів, {flatNodes.filter(n => (n.node.children?.length ?? 0) === 0).length} листків
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {mainTab === 'questions' && (
        <div className={styles.tabContent}>
          <div className={styles.subTabs}>
            {(['quarantine', 'reports', 'pools'] as QuestionsSubTab[]).map((st) => (
              <button
                key={st}
                type="button"
                className={`${styles.subTabBtn} ${subTab === st ? styles.subTabActive : ''}`}
                onClick={() => setSubTab(st)}
              >
                {st === 'quarantine' && `🚧 Карантин (${quarantineStats.total})`}
                {st === 'reports' && '📋 Звіти якості'}
                {st === 'pools' && '🗂️ Пули питань'}
              </button>
            ))}
          </div>

          {subTab === 'quarantine' && (
            <div>
              <div className={styles.statsRow}>
                <span className={styles.stat}>Всього: {quarantineStats.total}</span>
                <span className={styles.stat}>Очікує: {quarantineStats.pending_review}</span>
                <span className={styles.stat}>Схвалено: {quarantineStats.approved_fix}</span>
                <span className={styles.stat}>Відхилено: {quarantineStats.rejected}</span>
              </div>

              <button type="button" className={styles.primaryBtn} onClick={handleValidateAll}>
                🔍 Перевірити всі питання
              </button>

              {quarantineList.length === 0 ? (
                <p className={styles.muted}>Карантин порожній</p>
              ) : (
                <ul className={styles.list}>
                  {quarantineList.map((q) => {
                    const question = allQuestionsWithAi.get(q.questionId);
                    const report = questionQuarantineManager.getQualityReport(q.questionId);
                    return (
                      <li key={q.questionId} className={styles.card}>
                        <div className={styles.cardHead}>
                          <span className={styles.badge}>
                            {q.status === 'pending_review' ? '⏳' : q.status === 'approved_fix' ? '✅' : '❌'}
                            {q.status}
                          </span>
                          <span className={styles.muted}>{q.quarantinedBy}</span>
                        </div>
                        <p className={styles.questionText}>
                          {question ? question.text : `ID: ${q.questionId}`}
                        </p>
                        {question && (
                          <>
                            <p className={styles.muted}>
                              {themeLabel(question.themeId)} · {DIFFICULTY_LABELS[question.difficulty]}
                            </p>
                            <div className={styles.optionsList}>
                              {question.options.map((option, index) => (
                                <p
                                  key={index}
                                  className={`${styles.optionItem} ${
                                    index === question.correctIndex ? styles.correctOption : ''
                                  }`}
                                >
                                  {index + 1}. {option} {index === question.correctIndex && '✅'}
                                </p>
                              ))}
                            </div>
                            {question.explanationShort && (
                              <p className={styles.explanation}>
                                Коротке пояснення: {question.explanationShort}
                              </p>
                            )}
                            {question.explanationDeep && (
                              <p className={styles.explanation}>
                                Детальне пояснення: {question.explanationDeep}
                              </p>
                            )}
                          </>
                        )}
                        <p className={styles.reason}>Причина: {q.reason}</p>
                        {report && (
                          <p className={styles.muted}>Якість: {report.qualityScore}/100</p>
                        )}
                        <div className={styles.cardActions}>
                          {q.status === 'pending_review' && (
                            <>
                              <button
                                type="button"
                                className={styles.miniBtn}
                                onClick={() => handleApproveFix(q.questionId)}
                              >
                                ✅ Схвалити
                              </button>
                              <button
                                type="button"
                                className={styles.miniBtnDanger}
                                onClick={() => handleReject(q.questionId)}
                              >
                                ❌ Відхилити
                              </button>
                            </>
                          )}
                          {(q.status === 'approved_fix' || q.status === 'rejected') && (
                            <button
                              type="button"
                              className={styles.miniBtn}
                              onClick={() => handleRelease(q.questionId)}
                            >
                              🗑️ Видалити з карантину
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {subTab === 'reports' && (
            <div>
              <div className={styles.statsRow}>
                <span className={styles.stat}>Звітів: {qualityReports.length}</span>
                <span className={styles.stat}>
                  Сер. якість:{' '}
                  {qualityReports.length > 0
                    ? Math.round(
                        qualityReports.reduce((s, r) => s + r.qualityScore, 0) /
                          qualityReports.length,
                      )
                    : '—'}
                  /100
                </span>
              </div>

              <div className={styles.filterRow}>
                <span className={styles.muted}>Фільтр за severity:</span>
                {(['all', 'low', 'medium', 'high'] as SeverityFilter[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`${styles.miniBtn} ${severityFilter === s ? styles.miniBtnActive : ''}`}
                    onClick={() => setSeverityFilter(s)}
                  >
                    {s === 'all' ? 'Всі' : s === 'low' ? '🟢 Low' : s === 'medium' ? '🟡 Med' : '🔴 High'}
                  </button>
                ))}
              </div>

              <button type="button" className={styles.primaryBtn} onClick={handleValidateAll}>
                🔍 Оновити звіти
              </button>

              {filteredReports.length === 0 ? (
                <p className={styles.muted}>Немає звітів. Натисни "Перевірити всі питання"</p>
              ) : (
                <ul className={styles.list}>
                  {filteredReports.map((r) => {
                    const question = allQuestionsWithAi.get(r.questionId);
                    return (
                      <li key={r.questionId} className={styles.card}>
                        <div className={styles.cardHead}>
                          <span
                            className={`${styles.badge} ${r.status === 'approved' ? styles.badgeGreen : r.status === 'quarantined' ? styles.badgeRed : ''}`}
                          >
                            {r.status}
                          </span>
                          <span className={styles.scoreLabel}>{r.qualityScore}/100</span>
                        </div>
                        <p className={styles.questionText}>
                          {question ? question.text : `ID: ${r.questionId}`}
                        </p>
                        {question && (
                          <>
                            <div className={styles.optionsList}>
                              {question.options.map((option, index) => (
                                <p
                                  key={index}
                                  className={`${styles.optionItem} ${
                                    index === question.correctIndex ? styles.correctOption : ''
                                  }`}
                                >
                                  {index + 1}. {option} {index === question.correctIndex && '✅'}
                                </p>
                              ))}
                            </div>
                            {question.explanationShort && (
                              <p className={styles.explanation}>
                                Коротке пояснення: {question.explanationShort}
                              </p>
                            )}
                            {question.explanationDeep && (
                              <p className={styles.explanation}>
                                Детальне пояснення: {question.explanationDeep}
                              </p>
                            )}
                          </>
                        )}
                        <div className={styles.issueList}>
                          {r.issues.map((issue, i) => (
                            <span
                              key={i}
                              className={`${styles.issueTag} ${
                                issue.severity === 'high'
                                  ? styles.issueHigh
                                  : issue.severity === 'medium'
                                    ? styles.issueMed
                                    : styles.issueLow
                              }`}
                            >
                              [{issue.severity}] {issue.message}
                            </span>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {subTab === 'pools' && (
            <div>
              <div className={styles.poolGrid}>
                <div className={styles.poolCard}>
                  <h3>📚 Study Pool</h3>
                  <p className={styles.poolCount}>{poolStats.study.total} питань</p>
                  <div className={styles.poolDetails}>
                    <p className={styles.muted}>За складністю:</p>
                    {Object.entries(poolStats.study.byDifficulty).map(([d, count]) => (
                      <span key={d} className={styles.poolTag} style={{ borderColor: difficultyColor(d as Difficulty) }}>
                        {DIFFICULTY_LABELS[d as Difficulty]}: {count}
                      </span>
                    ))}
                  </div>
                </div>

                <div className={styles.poolCard}>
                  <h3>🎮 Game Pool</h3>
                  <p className={styles.poolCount}>{poolStats.game.total} питань</p>
                  <div className={styles.poolDetails}>
                    <p className={styles.muted}>За складністю:</p>
                    {Object.entries(poolStats.game.byDifficulty).map(([d, count]) => (
                      <span key={d} className={styles.poolTag} style={{ borderColor: difficultyColor(d as Difficulty) }}>
                        {DIFFICULTY_LABELS[d as Difficulty]}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.poolOverlap}>
                <h3>🔄 Перекриття пулів</h3>
                <p className={styles.poolCount}>{poolStats.overlap} питань спільні для обох пулів</p>
              </div>

              <div className={styles.poolCard}>
                <h3>📊 За темами (Study Pool)</h3>
                <div className={styles.themeBreakdown}>
                  {Object.entries(poolStats.study.byTheme).map(([themeId, count]) => (
                    <span key={themeId} className={styles.poolTag}>
                      {themeLabel(themeId)}: {count}
                    </span>
                  ))}
                </div>
              </div>

              <div className={styles.poolCard}>
                <h3>📊 За темами (Game Pool)</h3>
                <div className={styles.themeBreakdown}>
                  {Object.entries(poolStats.game.byTheme).map(([themeId, count]) => (
                    <span key={themeId} className={styles.poolTag}>
                      {themeLabel(themeId)}: {count}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
