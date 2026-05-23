import type { Question } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';
import styles from './ExplanationModal.module.css';

interface ExplanationModalProps {
  question: Question;
  open: boolean;
  onClose: () => void;
}

export function ExplanationModal({ question, open, onClose }: ExplanationModalProps) {
  const focusTrapRef = useFocusTrap(open);

  if (!open) return null;

  const answer = question.options[question.correctIndex];

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <article
        className={styles.modal}
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="explanation-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <span className={styles.kicker}>Пояснення</span>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Закрити">
            ×
          </button>
        </header>

        <h2 id="explanation-title">{question.text}</h2>

        <dl className={styles.details}>
          <div>
            <dt>Правильна відповідь</dt>
            <dd className={styles.correctAnswer}>{answer}</dd>
          </div>

          {question.reference && (
            <div>
              <dt>Посилання</dt>
              <dd>{question.reference}</dd>
            </div>
          )}
        </dl>

        <p className={styles.explanation}>
          Це питання прив&rsquo;язане до біблійного факту або події. Зверни увагу на
          правильну відповідь і посилання: вони допомагають закріпити контекст,
          а не просто запам&rsquo;ятати варіант.
        </p>

        <button type="button" className={styles.primaryButton} onClick={onClose}>
          Зрозуміло
        </button>
      </article>
    </div>
  );
}
