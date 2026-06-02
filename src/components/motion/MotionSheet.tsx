import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  backdropVariants,
  reducedTransition,
  sheetVariants,
  transitionUi,
} from '../../lib/motion';

interface MotionSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  backdropClassName?: string;
  'aria-labelledby'?: string;
}

export function MotionSheet({
  open,
  onClose,
  children,
  className,
  backdropClassName,
  'aria-labelledby': ariaLabelledby,
}: MotionSheetProps) {
  const reduced = useReducedMotion();

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence mode="wait" initial={false}>
      {open && (
        <motion.div
          className={backdropClassName}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabelledby}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={backdropVariants}
          transition={reducedTransition(transitionUi, !!reduced)}
          onClick={onClose}
        >
          <motion.div
            className={className}
            variants={sheetVariants}
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
