import type { ReactNode } from 'react';
import { useId } from 'react';
import { MotionSheet } from '../motion/MotionSheet';
import styles from './BottomSheet.module.css';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/**
 * Token-styled bottom sheet — surface, radius, drag handle and safe-area
 * padding on top of the existing `MotionSheet` motion/portal primitive.
 * Motion timing itself is WS4's domain (ADR-010); this only supplies the
 * visual shell.
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const titleId = useId();
  return (
    <MotionSheet
      open={open}
      onClose={onClose}
      className={styles.sheet}
      backdropClassName={styles.backdrop}
      aria-labelledby={title ? titleId : undefined}
    >
      <div className={styles.handle} aria-hidden="true" />
      {title && (
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
      )}
      {children}
    </MotionSheet>
  );
}
