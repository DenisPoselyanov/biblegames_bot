import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  backdropVariants,
  dialogVariants,
  reducedTransition,
  transitionUi,
} from '../../lib/motion';

interface MotionDialogProps {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  overlayClassName?: string;
  modalClassName?: string;
  'aria-labelledby'?: string;
  closeOnBackdrop?: boolean;
}

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
