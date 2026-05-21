import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMixedQuestionsByDifficulty } from '../../data/questions';
import { usePlayer } from '../../context/PlayerContext';
import { ExplanationModal } from '../../components/ExplanationModal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { haptic } from '../../lib/telegram';
import type { Difficulty, Question } from '../../types';
import styles from './Millionaire.module.css';

const LEVEL_POINTS = [5, 10, 15, 25, 40, 60, 90, 130, 180, 250, 350, 500, 700, 1000, 1500];
const SAFE_LEVELS = new Set([5, 10]);

function getDifficultyForLevel(level: number): Difficulty {
  if (level <= 3) return 'beginner';
  if (level <= 6) return 'easy';
  if (level <= 9) return 'medium';
  if (level <= 12) return 'hard';
  return 'expert';
}

function buildMillionaireQuestions(): Question[] {
  const picked: Question[] = [];

  for (let level = 1; level <= 15; level += 1) {
    const [question] = getMixedQuestionsByDifficulty(
      getDifficultyForLevel(level),
      1,
      picked.map((item) => item.id),
    );

    if (question) picked.push(question);
  }

  return picked;
}

function getSafePoints(reachedLevel: number): number {
  if (reachedLevel >= 10) return LEVEL_POINTS[9];
  if (reachedLevel >= 5) return LEVEL_POINTS[4];
  return 0;
}

export function Millionaire() {
  const { saveMillionaireRun, unlockAchievement } = usePlayer();
  const [questions, setQuestions] = useState<Question[]>(() => buildMillionaireQuestions());
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [hiddenOptions, setHiddenOptions] = useState<number[]>([]);
  const [usedFiftyFifty, setUsedFiftyFifty] = useState(false);
  const [usedSwap, setUsedSwap] = useState(false);
  const [usedSecondChance, setUsedSecondChance] = useState(false);
  const [secondChanceActive, setSecondChanceActive] = useState(false);
  const [blockedWrongOptions, setBlockedWrongOptions] = useState<number[]>([]);
  const [status, setStatus] = useState<'playing' | 'answered' | 'finished'>('playing');
  const [notice, setNotice] = useState<string | null>(null);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [result, setResult] = useState<{ title: string; points: number; reachedLevel: number } | null>(null);
  
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [takeConfirmOpen, setTakeConfirmOpen] = useState(false);

  const current = questions[index];
  const currentLevel = index + 1;
  const currentPrize = LEVEL_POINTS[index] ?? 0;
  const earnedBeforeCurrent = index > 0 ? LEVEL_POINTS[index - 1] : 0;

  const orderedLevels = useMemo(
    () =>
      LEVEL_POINTS.map((points, levelIndex) => ({
        level: levelIndex + 1,
        points,
        active: levelIndex === index,
        safe: SAFE_LEVELS.has(levelIndex + 1),
      })).reverse(),
    [index],
  );

  const finishGame = (title: string, points: number, reachedLevel: number) => {
    saveMillionaireRun(reachedLevel, points);
    if (reachedLevel >= 15) {
      unlockAchievement('biblical-millionaire');
      haptic.notification('success');
    } else {
      haptic.notification('warning');
    }
    setResult({ title, points, reachedLevel });
    setStatus('finished');
  };

  const restart = () => {
    setQuestions(buildMillionaireQuestions());
    haptic.impact('light');
    setIndex(0);
    setSelected(null);
    setHiddenOptions([]);
    setUsedFiftyFifty(false);
    setUsedSwap(false);
    setUsedSecondChance(false);
    setSecondChanceActive(false);
    setBlockedWrongOptions([]);
    setNotice(null);
    setExplanationOpen(false);
    setStatus('playing');
    setResult(null);
  };

  const useFiftyFifty = () => {
    if (!current || usedFiftyFifty || status !== 'playing') return;

    haptic.impact('medium');
    const wrongOptions = current.options
      .map((_, optionIndex) => optionIndex)
      .filter((optionIndex) => optionIndex !== current.correctIndex);

    setHiddenOptions(wrongOptions.sort(() => Math.random() - 0.5).slice(0, 2));
    setUsedFiftyFifty(true);
  };

  const swapQuestion = () => {
    if (!current || usedSwap || status !== 'playing') return;

    haptic.impact('medium');
    const [replacement] = getMixedQuestionsByDifficulty(
      current.difficulty,
      1,
      questions.map((question) => question.id),
    );

    if (!replacement) return;

    setQuestions((currentQuestions) =>
      currentQuestions.map((question, questionIndex) =>
        questionIndex === index ? replacement : question,
      ),
    );
    setHiddenOptions([]);
    setSelected(null);
    setUsedSwap(true);
    setNotice(null);
  };

  const useSecondChance = () => {
    if (usedSecondChance || status !== 'playing') return;

    haptic.impact('medium');
    setUsedSecondChance(true);
    setSecondChanceActive(true);
    setNotice('Право на помилку активне для цього питання.');
  };

  const handleAnswer = (optionIndex: number) => {
    if (!current || status !== 'playing') return;

    setSelected(optionIndex);

    if (optionIndex !== current.correctIndex) {
      if (secondChanceActive) {
        haptic.notification('warning');
        setBlockedWrongOptions((items) => [...items, optionIndex]);
        setSecondChanceActive(false);
        setSelected(null);
        setNotice('Цю помилку пробачено. Обери інший варіант.');
        return;
      }

      haptic.notification('error');
      setStatus('answered');
      const reachedLevel = Math.max(0, index);
      finishGame('Гру завершено', getSafePoints(reachedLevel), reachedLevel);
      return;
    }

    haptic.notification('success');
    setStatus('answered');
    setNotice(null);
  };

  const handleNext = () => {
    if (!current) return;

    haptic.impact('light');

    if (index >= questions.length - 1) {
      finishGame('Перемога у Мільйонері!', currentPrize, 15);
      return;
    }

    setIndex((value) => value + 1);
    setSelected(null);
    setHiddenOptions([]);
    setBlockedWrongOptions([]);
    setSecondChanceActive(false);
    setNotice(null);
    setExplanationOpen(false);
    setStatus('playing');
  };

  const takePoints = () => {
    haptic.notification('success');
    finishGame('Бали збережено', earnedBeforeCurrent, index);
  };

  if (!current || questions.length < 15) {
    return (
      <section className={styles.page}>
        <article className={styles.resultCard}>
          <h1>Поки недостатньо питань</h1>
          <p>Для режиму потрібно зібрати 15 питань із різних рівнів складності.</p>
          <Link to="/play" className={styles.secondaryAction}>
            Назад до режимів
          </Link>
        </article>
      </section>
    );
  }

  if (result) {
    return (
      <section className={styles.page}>
        <article className={styles.resultCard}>
          <span className={styles.kicker}>Мільйонер</span>
          <h1>{result.title}</h1>
          <p className={styles.resultScore}>+{result.points} очок</p>
          <p>Досягнуто рівень {result.reachedLevel} з 15.</p>
          <button type="button" className={styles.primaryAction} onClick={restart}>
            Спробувати ще раз
          </button>
          <Link to="/play" className={styles.secondaryAction}>
            Назад до режимів
          </Link>
        </article>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <header className={styles.top}>
        <div className={styles.topRow}>
          <span className={styles.topTitle}>Мільйонер</span>
        </div>
        <aside className={styles.ladder} aria-label="Рівні Мільйонера">
          {orderedLevels.map((item) => (
            <span
              key={item.level}
              className={`${styles.ladderStep} ${item.active ? styles.activeStep : ''} ${item.safe ? styles.safeStep : ''}`}
            >
              {item.level}. {item.points}
            </span>
          ))}
        </aside>
      </header>

      <div className={styles.spacer} aria-hidden />

      <footer className={styles.bottomPanel}>
        <div className={styles.panelHeader}>
          <span className={styles.kicker}>Питання {currentLevel} з 15</span>
          <h1 className={styles.prizeTitle}>{currentPrize} очок</h1>
        </div>

        <div className={styles.lifelines} aria-label="Підказки">
          <button
            type="button"
            onClick={useFiftyFifty}
            disabled={usedFiftyFifty || status !== 'playing'}
          >
            50:50
          </button>
          <button
            type="button"
            onClick={swapQuestion}
            disabled={usedSwap || status !== 'playing'}
          >
            Заміна
          </button>
          <button
            type="button"
            onClick={useSecondChance}
            disabled={usedSecondChance || status !== 'playing'}
          >
            Помилка
          </button>
        </div>

        {notice && <p className={styles.notice}>{notice}</p>}

        <p className={styles.questionText}>{current.text}</p>

        <ul className={styles.options}>
          {current.options.map((option, optionIndex) => {
            const isHidden =
              hiddenOptions.includes(optionIndex) ||
              blockedWrongOptions.includes(optionIndex);
            const isCorrect = optionIndex === current.correctIndex;
            const isSelected = optionIndex === selected;
            let stateClass = '';
            if (status === 'answered') {
              if (isCorrect) stateClass = styles.correct;
              else if (isSelected) stateClass = styles.wrong;
            } else if (isSelected) {
              stateClass = styles.selected;
            }

            return (
              <li key={option}>
                <button
                  type="button"
                  className={`${styles.option} ${stateClass}`}
                  onClick={() => handleAnswer(optionIndex)}
                  disabled={status !== 'playing' || isHidden}
                >
                  {isHidden ? '—' : option}
                </button>
              </li>
            );
          })}
        </ul>

        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.btnExit}
            onClick={() => {
              haptic.impact('light');
              setExitConfirmOpen(true);
            }}
          >
            Вийти
          </button>

          {status === 'playing' && (
            <button
              type="button"
              className={styles.btnTake}
              onClick={() => {
                haptic.impact('light');
                setTakeConfirmOpen(true);
              }}
              disabled={index === 0}
            >
              Забрати {earnedBeforeCurrent}
            </button>
          )}

          {status === 'answered' && (
            <button type="button" className={styles.btnPrimary} onClick={handleNext}>
              {index === questions.length - 1 ? 'Завершити' : 'Далі →'}
            </button>
          )}
        </div>
      </footer>

      <ExplanationModal
        question={current}
        open={explanationOpen}
        onClose={() => setExplanationOpen(false)}
      />

      <ConfirmModal
        open={exitConfirmOpen}
        title="Вийти з гри?"
        message="Ви дійсно бажаєте вийти? Ваш поточний прогрес у цьому забігу буде втрачено."
        confirmText="Вийти"
        cancelText="Залишитися"
        onConfirm={() => {
          setExitConfirmOpen(false);
          // Використовуємо window.location або Link-подібний підхід:
          window.location.href = '/play';
        }}
        onCancel={() => setExitConfirmOpen(false)}
      />

      <ConfirmModal
        open={takeConfirmOpen}
        title="Забрати бали?"
        message={`Ви дійсно хочете забрати ${earnedBeforeCurrent} очок та безпечно завершити гру?`}
        confirmText="Забрати"
        cancelText="Продовжити гру"
        onConfirm={() => {
          setTakeConfirmOpen(false);
          takePoints();
        }}
        onCancel={() => setTakeConfirmOpen(false)}
      />
    </section>
  );
}

