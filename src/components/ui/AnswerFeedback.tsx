import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { answerFeedbackVariants, reducedTransition, transitionUi } from '../../lib/motion';
import { Icon } from '../Icon';
import { cx } from './cx';
import styles from './AnswerFeedback.module.css';

interface AnswerFeedbackProps {
  correct: boolean;
  explanation?: string;
  reference?: string;
  /** Reward is always secondary to the explanation (§14.1). */
  reward?: ReactNode;
  className?: string;
}

/** Correct/incorrect result panel — icon + text, never color alone (§14). */
export function AnswerFeedback({ correct, explanation, reference, reward, className }: AnswerFeedbackProps) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={cx(styles.feedback, correct ? styles['feedback--correct'] : styles['feedback--wrong'], className)}
      variants={answerFeedbackVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={reducedTransition(transitionUi, !!reduced)}
      role="status"
    >
      <div className={styles.headline}>
        <Icon name={correct ? 'success' : 'error'} size={20} aria-label="" />
        <span>{correct ? 'Правильно!' : 'Неправильно'}</span>
      </div>
      {explanation && <p className={styles.explanation}>{explanation}</p>}
      {reference && <p className={styles.reference}>{reference}</p>}
      {reward && <div className={styles.reward}>{reward}</div>}
    </motion.div>
  );
}
