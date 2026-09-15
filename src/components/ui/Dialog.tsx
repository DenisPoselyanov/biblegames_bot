import type { ReactNode } from 'react';
import { useId } from 'react';
import { MotionDialog } from '../motion/MotionDialog';
import { cx } from './cx';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  closeOnBackdrop?: boolean;
  className?: string;
}

/** Token-styled centered dialog on top of the existing `MotionDialog` motion/portal primitive. */
export function Dialog({ open, onClose, title, children, actions, closeOnBackdrop = true, className }: DialogProps) {
  const titleId = useId();
  return (
    <MotionDialog
      open={open}
      onClose={onClose}
      overlayClassName={styles.overlay}
      modalClassName={cx(styles.modal, className)}
      aria-labelledby={title ? titleId : undefined}
      closeOnBackdrop={closeOnBackdrop}
    >
      {title && (
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
      )}
      {children}
      {actions && <div className={styles.actions}>{actions}</div>}
    </MotionDialog>
  );
}
