import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  backdropVariants,
  dialogVariants,
  reducedTransition,
  transitionUi,
} from '../../lib/motion';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useOverlayDismiss } from '../../hooks/useOverlayDismiss';

interface MotionDialogProps {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  overlayClassName?: string;
  modalClassName?: string;
  'aria-labelledby'?: string;
  closeOnBackdrop?: boolean;
}

/**
 * Centered dialog motion/portal primitive — also owns the §20.3 functional
 * contract shared by every dialog: focus trap + restoration, body scroll
 * lock, and Escape/Telegram-BackButton dismiss (skipped when `onClose` is
 * not provided, e.g. a blocking dialog with no dismiss action).
 */
export function MotionDialog({
  open,
  onClose,
  children,
  overlayClassName,
  modalClassName,
  'aria-labelledby': ariaLabelledby,
  closeOnBackdrop = true,
}: MotionDialogProps) {
  const reduced = useReducedMotion();
  const focusTrapRef = useFocusTrap(open);
  useBodyScrollLock(open);
  useOverlayDismiss(open, onClose);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence mode="wait" initial={false}>
      {open && (
        <motion.div
          className={overlayClassName}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabelledby}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={backdropVariants}
          transition={reducedTransition(transitionUi, !!reduced)}
          onClick={closeOnBackdrop ? onClose : undefined}
        >
          <motion.div
            ref={focusTrapRef}
            className={modalClassName}
            variants={dialogVariants}
            transition={reducedTransition(transitionUi, !!reduced)}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
