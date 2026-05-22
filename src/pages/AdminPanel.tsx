import { useEffect, useMemo, useState } from 'react';

import { Link } from 'react-router-dom';
import { ALL_QUESTIONS } from '../data/questions';
import { loadAllAiQuestions } from '../data/questionDbLoader';
import { THEMES } from '../data/themes';
import { DIFFICULTY_LABELS, type Difficulty } from '../types';
import { questionQualityValidator } from '../lib/questionQuality';
import { questionQuarantineManager } from '../lib/questionQuarantine';
import { questionPoolManager } from '../lib/questionPools';
import styles from './AdminPanel.module.css';

type Tab = 'quarantine' | 'reports' | 'pools';
type SeverityFilter = 'all' | 'low' | 'medium' | 'high';

function themeLabel(themeId: string): string {
  return THEMES.find((t) => t.id === themeId)?.title ?? themeId;
}

function difficultyColor(d: Difficulty): string {
  const map: Record<Difficulty, string> = {
    beginner: '#6a9',
    easy: '#6a9',
    medium: '#ca3',
    hard: '#e88',
    expert: '#e55',
  };
  return map[d] || '#888';
}

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>('quarantine');
  const [version, setVersion] = useState(0);
  const [poolVersion, setPoolVersion] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');

  // Завантажуємо AI питання та ініціалізуємо пули
  useEffect(() => {
    loadAllAiQuestions().then((aiQuestions) => {
      const all = [...ALL_QUESTIONS, ...aiQuestions];
      questionPoolManager.initializePools(all);
      setPoolVersion((v) => v + 1);
    });
  }, []);

  const allQuestionsMap = useMemo(() => {
    const map = new Map<string, (typeof ALL_QUESTIONS)[number]>();
    for (const q of ALL_QUESTIONS) map.set(q.id, q);
    return map;
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

  return (
    <section className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>Адмін-панель</h1>
        <Link to="/profile" className={styles.backBtn}>← Профіль</Link>
      </div>

      <div className={styles.tabs}>
        {(['quarantine', 'reports', 'pools'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.tabBtn} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'quarantine' && `🚧 Карантин (${quarantineStats.total})`}
            {t === 'reports' && '📋 Звіти якості'}
            {t === 'pools' && '🗂️ Пули питань'}
          </button>
        ))}
      </div>

      {tab === 'quarantine' && (
        <div className={styles.tabContent}>
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
                const question = allQuestionsMap.get(q.questionId);
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

      {tab === 'reports' && (
        <div className={styles.tabContent}>
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
                const question = allQuestionsMap.get(r.questionId);
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

      {tab === 'pools' && (
        <div className={styles.tabContent}>
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
    </section>
  );
}
