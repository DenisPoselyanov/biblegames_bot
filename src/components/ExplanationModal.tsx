import type { Question } from '../types';
import { useResolvedProfile } from '../hooks/domain/useProfileWriter';
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
  const profile = useResolvedProfile();
  const translation = normalizeBollsTranslation(profile.bibleTranslation);

  const answer = question.options[question.correctIndex];
  // Short = the confirmation shown at every level; deep = the level-appropriate context
  // (expected from «Проповідник» up, see src/lib/contentLevelRubric.ts). Show both.
  const shortText = question.explanationShort?.trim() || null;
  const deepText = question.explanationDeep?.trim() || null;

  return (
    <MotionSheet
      open={open}
      onClose={onClose}
      backdropClassName={styles.backdrop}
      className={styles.modal}
      aria-labelledby="explanation-title"
    >
      <article>
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

        {shortText && <p className={styles.explanation}>{shortText}</p>}
        {deepText && deepText !== shortText && (
          <section className={styles.deep} aria-label="Детальніше">
            <h3 className={styles.deepTitle}>Детальніше</h3>
            <p className={styles.explanation}>{deepText}</p>
          </section>
        )}

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
