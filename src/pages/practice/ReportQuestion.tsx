import { useState } from 'react';
import { BottomSheet, Button } from '../../components/ui';
import { contentReportsRepo, type ContentReportCategory } from '../../repos/contentReportsRepo';
import styles from './ReportQuestion.module.css';

/**
 * "Повідомити про помилку" (Phase 4 WS9, spec §14) — the player-side entry
 * into the content-report workflow. The report goes to Content Studio's
 * review queue; it never changes the question and shows nothing about other
 * players' reports. Offered only after the answer is revealed, so the player
 * reports what they actually saw (question + key + explanation).
 */

const CATEGORIES: Array<{ id: ContentReportCategory; label: string }> = [
  { id: 'wrong_answer', label: 'Неправильна відповідь' },
  { id: 'wording', label: 'Незрозуміле формулювання' },
  { id: 'reference', label: 'Хибне посилання на Писання' },
  { id: 'translation', label: 'Помилка в мові чи перекладі' },
  { id: 'offensive', label: 'Чутливе або образливе' },
  { id: 'technical', label: 'Технічна проблема' },
];

type State = 'idle' | 'sending' | 'sent' | 'duplicate' | 'error';

export function ReportQuestion({
  questionId,
  revisionId,
  sessionId,
}: {
  questionId: string;
  revisionId: string;
  sessionId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ContentReportCategory | null>(null);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<State>('idle');

  const close = () => {
    setOpen(false);
    if (state !== 'sent' && state !== 'duplicate') setState('idle');
  };

  const submit = async () => {
    if (!category) return;
    setState('sending');
    try {
      const res = await contentReportsRepo.create({
        entityType: 'question',
        entityId: questionId,
        revisionId,
        category,
        comment: comment.trim() || undefined,
        sessionId,
      });
      setState(res.duplicate ? 'duplicate' : 'sent');
    } catch {
      setState('error');
    }
  };

  const done = state === 'sent' || state === 'duplicate';

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)} disabled={done}>
        {done ? 'Дякуємо — ми перевіримо це питання' : 'Повідомити про помилку'}
      </button>
      <BottomSheet open={open} onClose={close} title="Що не так із питанням?">
        {done ? (
          <div className={styles.body}>
            <p className={styles.thanks}>
              {state === 'sent'
                ? 'Дякуємо! Редактор перевірить питання. Саме питання не зміниться, доки людина його не перегляне.'
                : 'Ви вже повідомляли про це. Скарга чекає на перевірку.'}
            </p>
            <Button fullWidth onClick={close}>
              Гаразд
            </Button>
          </div>
        ) : (
          <div className={styles.body}>
            <div className={styles.options} role="radiogroup" aria-label="Тип помилки">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={category === c.id}
                  className={category === c.id ? styles.optionActive : styles.option}
                  onClick={() => setCategory(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <label className={styles.commentLabel}>
              Коментар (необовʼязково)
              <textarea
                className={styles.comment}
                rows={3}
                maxLength={500}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Наприклад: у Бут 6:14 сказано інакше"
              />
            </label>
            {state === 'error' && (
              <p role="alert" className={styles.error}>
                Не вдалося надіслати. Спробуйте ще раз.
              </p>
            )}
            <Button fullWidth disabled={!category || state === 'sending'} onClick={submit}>
              {state === 'sending' ? 'Надсилаю…' : 'Надіслати'}
            </Button>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
