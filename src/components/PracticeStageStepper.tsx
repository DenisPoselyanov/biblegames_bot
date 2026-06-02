import { Link } from 'react-router-dom';
import type { Difficulty, PracticeTrackProgress } from '../types';
import {
  getStageQuizPath,
  isStagePassed,
  isStageUnlocked,
  STAGE_COUNT_BY_DIFFICULTY,
} from '../lib/practiceProgression';
import { getStageQuestionCount } from '../data/questions';
import styles from './PracticeStageStepper.module.css';

interface PracticeStageStepperProps {
  themeId: string;
  difficulty: Difficulty;
  nodeId: string | null;
  questionPoolSize: number;
  track?: PracticeTrackProgress;
}

export function PracticeStageStepper({
  themeId,
  difficulty,
  nodeId,
  questionPoolSize,
  track,
}: PracticeStageStepperProps) {
  const stageCount = STAGE_COUNT_BY_DIFFICULTY[difficulty];
  const highestUnlocked = track?.highestUnlockedStage ?? 0;

  return (
    <div className={styles.stepper} role="list" aria-label="Етапи практики">
      {Array.from({ length: stageCount }, (_, stageIndex) => {
        const unlocked = track ? isStageUnlocked(track, stageIndex) : stageIndex === 0;
        const passed = track ? isStagePassed(track, stageIndex) : false;
        const stageResult = track?.stageResults.find((r) => r.stageIndex === stageIndex);
        const bestCorrect = stageResult?.bestCorrect ?? stageResult?.correct ?? 0;
        const stageTotal = stageResult?.total ?? 0;
        const isPerfect = Boolean(stageResult?.perfect) || (stageTotal > 0 && bestCorrect >= stageTotal);
        const stageQuestions = getStageQuestionCount(questionPoolSize, stageIndex);
        const hasQuestions = stageQuestions >= 10;
        const isCurrent = unlocked && !passed && stageIndex === highestUnlocked;
        const path = getStageQuizPath(themeId, difficulty, stageIndex, nodeId);

        let className = styles.stage;
        if (!hasQuestions) className += ` ${styles.stageDisabled}`;
        else if (!unlocked) className += ` ${styles.stageLocked}`;
        else if (isPerfect) className += ` ${styles.stagePerfect}`;
        else if (passed) className += ` ${styles.stagePassed}`;
        else if (isCurrent) className += ` ${styles.stageCurrent}`;

        const label = !hasQuestions
          ? '—'
          : isPerfect
            ? '★'
            : passed
            ? '✓'
            : !unlocked
              ? '🔒'
              : `${stageIndex + 1}`;

        if (!hasQuestions || !unlocked) {
          return (
            <div key={stageIndex} className={className} role="listitem" aria-label={`Етап ${stageIndex + 1}`}>
              {label}
              <span className={styles.stageLabel}>
                {!hasQuestions ? 'мало' : `Е${stageIndex + 1}`}
              </span>
            </div>
          );
        }

        return (
          <Link
            key={stageIndex}
            to={path}
            className={className}
            role="listitem"
            aria-label={`Етап ${stageIndex + 1}${isPerfect ? ', без помилок' : passed ? ', пройдено' : ''}`}
          >
            {label}
            <span className={styles.stageLabel}>Е{stageIndex + 1}</span>
          </Link>
        );
      })}
    </div>
  );
}
