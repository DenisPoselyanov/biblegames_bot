import { useEffect, useState } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { ConfirmModal } from './ConfirmModal';
import { haptic } from '../lib/telegram';
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  type Difficulty,
  type Question,
} from '../types';
import { MotionSheet } from './motion';
import styles from './QuestionEditModal.module.css';

interface QuestionEditModalProps {
  question: Question;
  open: boolean;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (question: Question) => void | Promise<void>;
  onDelete: (questionId: string) => void | Promise<void>;
}

export function QuestionEditModal({
  question,
  open,
  saving = false,
  error = null,
  onClose,
  onSave,
  onDelete,
}: QuestionEditModalProps) {
  const focusTrapRef = useFocusTrap(open);
  const [text, setText] = useState(question.text);
  const [options, setOptions] = useState<string[]>([...question.options]);
  const [correctIndex, setCorrectIndex] = useState(question.correctIndex);
  const [reference, setReference] = useState(question.reference ?? '');
  const [explanationShort, setExplanationShort] = useState(question.explanationShort ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>(question.difficulty);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setText(question.text);
    setOptions([...question.options]);
    setCorrectIndex(question.correctIndex);
    setReference(question.reference ?? '');
    setExplanationShort(question.explanationShort ?? '');
    setDifficulty(question.difficulty);
  }, [open, question]);

  const handleOptionChange = (index: number, value: string) => {
    setOptions((prev) => prev.map((opt, i) => (i === index ? value : opt)));
  };

  const handleSave = () => {
    const trimmedOptions = options.map((opt) => opt.trim());
    if (!text.trim() || trimmedOptions.some((opt) => !opt)) return;

    onSave({
      ...question,
      text: text.trim(),
      options: trimmedOptions,
      correctIndex,
      reference: reference.trim() || undefined,
      explanationShort: explanationShort.trim() || undefined,
      difficulty,
    });
    haptic.notification('success');
  };

  return (
    <>
      <MotionSheet
        open={open}
        onClose={onClose}
        backdropClassName={styles.backdrop}
        className={styles.modal}
        aria-labelledby="edit-question-title"
      >
        <article ref={focusTrapRef}>
          <header className={styles.header}>
            <span className={styles.kicker}>Редагування</span>
            <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Закрити">
              ×
            </button>
          </header>

          <h2 id="edit-question-title" className={styles.questionId}>
            {question.id}
          </h2>

          <label className={styles.field}>
            <span>Текст питання</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
            />
          </label>

          <fieldset className={styles.optionsFieldset}>
            <legend>Варіанти відповіді</legend>
            {options.map((opt, i) => (
              <label key={i} className={styles.optionRow}>
                <input
                  type="radio"
                  name="correct"
                  checked={correctIndex === i}
                  onChange={() => setCorrectIndex(i)}
                />
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(i, e.target.value)}
                  aria-label={`Варіант ${i + 1}`}
                />
              </label>
            ))}
          </fieldset>

          <label className={styles.field}>
            <span>Посилання на Писання</span>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Бут. 1:1"
            />
          </label>

          <label className={styles.field}>
            <span>Коротке пояснення</span>
            <textarea
              value={explanationShort}
              onChange={(e) => setExplanationShort(e.target.value)}
              rows={2}
            />
          </label>

          <label className={styles.field}>
            <span>Складність</span>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABELS[d]}
                </option>
              ))}
            </select>
          </label>

          <p className={styles.hint}>
            Зміни одразу записуються у файли проєкту (потрібен локальний сервер: npm run server:dev).
          </p>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={saving}
            >
              Видалити питання
            </button>
            <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? 'Збереження…' : 'Зберегти'}
            </button>
          </div>
        </article>
      </MotionSheet>

      <ConfirmModal
        open={deleteConfirmOpen}
        title="Видалити питання?"
        message="Питання буде видалено з файлів проєкту (question-db або exclusions.json)."
        confirmText="Видалити"
        cancelText="Скасувати"
        onConfirm={() => {
          setDeleteConfirmOpen(false);
          onDelete(question.id);
          haptic.notification('warning');
        }}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </>
  );
}
