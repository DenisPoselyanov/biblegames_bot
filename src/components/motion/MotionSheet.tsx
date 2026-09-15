import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  backdropVariants,
  reducedTransition,
  sheetVariants,
  transitionUi,
} from '../../lib/motion';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useOverlayDismiss } from '../../hooks/useOverlayDismiss';

interface MotionSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  backdropClassName?: string;
  'aria-labelledby'?: string;
}

/**
 * Bottom-sheet motion/portal primitive — also owns the §20.3 functional
 * contract shared by every sheet: focus trap + restoration, body scroll
 * lock, and Escape/Telegram-BackButton dismiss. Individual sheets (e.g.
 * `ExplanationModal`, `ui/BottomSheet`) don't need to wire these themselves.
 */
export function MotionSheet({
  open,
  onClose,
  children,
  className,
  backdropClassName,
  'aria-labelledby': ariaLabelledby,
}: MotionSheetProps) {
  const reduced = useReducedMotion();
  const focusTrapRef = useFocusTrap(open);
  useBodyScrollLock(open);
  useOverlayDismiss(open, onClose);

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
            ref={focusTrapRef}
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
