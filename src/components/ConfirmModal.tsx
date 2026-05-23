import { useEffect, useState } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import styles from './ConfirmModal.module.css';
import { haptic } from '../lib/telegram';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [render, setRender] = useState(open);
  const [animateIn, setAnimateIn] = useState(false);
  const focusTrapRef = useFocusTrap(open && render);

  useEffect(() => {
    if (open) {
      setRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimateIn(true));
      });
      haptic.impact('light');
    } else {
      setAnimateIn(false);
      const timer = setTimeout(() => setRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!render) return null;

  return (
    <div
      className={`${styles.overlay} ${animateIn ? styles.visible : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className={styles.modal} ref={focusTrapRef}>
        <h2 id="confirm-title" className={styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnCancel}
            onClick={() => {
              haptic.impact('light');
              onCancel();
            }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={styles.btnConfirm}
            onClick={() => {
              haptic.impact('medium');
              onConfirm();
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
