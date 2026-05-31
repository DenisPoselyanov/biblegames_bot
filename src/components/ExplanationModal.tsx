import type { Question } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { usePlayer } from '../context/PlayerContext';
import { normalizeBollsTranslation } from '../lib/bollsConstants';
import { ScripturePanel } from './ScripturePanel';
import styles from './ExplanationModal.module.css';

interface ExplanationModalProps {
  question: Question;
  open: boolean;
  onClose: () => void;
}

export function ExplanationModal({ question, open, onClose }: ExplanationModalProps) {
  const { profile } = usePlayer();
  const translation = normalizeBollsTranslation(profile.bibleTranslation);
  const focusTrapRef = useFocusTrap(open);

  if (!open) return null;

  const answer = question.options[question.correctIndex];
  const explanationText =
    question.explanationShort?.trim() ||
    question.explanationDeep?.trim() ||
    null;

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

        {open && question.reference && (
          <ScripturePanel reference={question.reference} translation={translation} />
        )}

        {explanationText ? (
          <p className={styles.explanation}>{explanationText}</p>
        ) : (
          <p className={styles.explanation}>
            Пояснення для цього питання ще готується. Зверни увагу на правильну відповідь
            {question.reference ? ' і посилання на Писання' : ''} — вони допомагають закріпити контекст.
          </p>
        )}

        <button type="button" className={styles.primaryButton} onClick={onClose}>
          Зрозуміло
        </button>
      </article>
    </div>
  );
}
