import type { Question } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { usePlayer } from '../context/PlayerContext';
import { normalizeBollsTranslation } from '../lib/bollsConstants';
import { MotionSheet } from './motion';
import { ScripturePanel } from './ScripturePanel';
import styles from './ExplanationModal.module.css';

interface ExplanationModalProps {
  question: Question;
  open: boolean;
  onClose: () => void;
  /** У швидких режимах (Виживання, Мільйонер) не відкривати bolls.life */
  showReaderLink?: boolean;
}

export function ExplanationModal({
  question,
  open,
  onClose,
  showReaderLink = true,
}: ExplanationModalProps) {
  const { profile } = usePlayer();
  const translation = normalizeBollsTranslation(profile.bibleTranslation);
  const focusTrapRef = useFocusTrap(open);

  const answer = question.options[question.correctIndex];
  const explanationText =
    question.explanationShort?.trim() ||
    question.explanationDeep?.trim() ||
    null;

  return (
    <MotionSheet
      open={open}
      onClose={onClose}
      backdropClassName={styles.backdrop}
      className={styles.modal}
      aria-labelledby="explanation-title"
    >
      <article ref={focusTrapRef}>
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
              <dt>Біблійне місце</dt>
              <dd>{question.reference}</dd>
            </div>
          )}
        </dl>

        {explanationText && <p className={styles.explanation}>{explanationText}</p>}

        {question.reference && (
          <ScripturePanel
            reference={question.reference}
            translation={translation}
            showReaderLink={showReaderLink}
          />
        )}
      </article>
    </MotionSheet>
  );
}
