import { useEffect } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { MotionDialog } from './motion';
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
  const focusTrapRef = useFocusTrap(open);

  useEffect(() => {
    if (open) haptic.impact('light');
  }, [open]);

  return (
    <MotionDialog
      open={open}
      onClose={onCancel}
      overlayClassName={styles.overlay}
      modalClassName={styles.modal}
      aria-labelledby="confirm-title"
    >
      <div ref={focusTrapRef}>
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
    </MotionDialog>
  );
}
