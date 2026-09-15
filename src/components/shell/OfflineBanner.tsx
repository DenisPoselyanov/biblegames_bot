import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { fadeOnlyVariants, reducedTransition, transitionUi } from '../../lib/motion';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { Icon } from '../Icon';
import styles from './OfflineBanner.module.css';

/** Global offline/reconnect banner (§6 app shell). */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const reduced = useReducedMotion();

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          className={styles.banner}
          role="status"
          initial="initial"
          animate="animate"
          exit="exit"
          variants={fadeOnlyVariants}
          transition={reducedTransition(transitionUi, !!reduced)}
        >
          <Icon name="wifi-off" size={16} />
          Немає з’єднання — деякі дії можуть не зберегтися
        </motion.div>
      )}
    </AnimatePresence>
  );
}
