import { AnimatePresence, motion } from 'framer-motion';
import { DURATION, EASE_SMOOTH } from '../../lib/motion';
import { useMotionCapabilities } from '../motion';
import styles from './CelebrationLayer.module.css';

interface CelebrationLayerProps {
  /**
   * Purely presentational — renders one restrained radiant burst while
   * `active` is true. It does NOT decide *when* a celebration is warranted
   * or guard against replaying on remount/reload: callers gate `active` on a
   * real, once-only authoritative event via `useEventOnce` (ADR-010,
   * MOTION_SYSTEM.md "event-consumption dedup").
   */
  active: boolean;
  className?: string;
}

const PARTICLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/** Restrained celebration burst — a soft radial glow + a few outward particles, never a full confetti shower. */
export function CelebrationLayer({ active, className }: CelebrationLayerProps) {
  const { particlesAllowed } = useMotionCapabilities();

  if (!particlesAllowed) return null;

  return (
    <div className={className ? `${styles.layer} ${className}` : styles.layer} aria-hidden="true">
      <AnimatePresence>
        {active && (
          <>
            <motion.div
              className={styles.glow}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 0], scale: 1.15 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.slow, ease: EASE_SMOOTH }}
            />
            {PARTICLE_ANGLES.map((angle) => {
              const rad = (angle * Math.PI) / 180;
              const x = Math.cos(rad) * 90;
              const y = Math.sin(rad) * 90;
              return (
                <motion.span
                  key={angle}
                  className={styles.particle}
                  initial={{ opacity: 0, x: 0, y: 0 }}
                  animate={{ opacity: [0, 1, 0], x, y }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: DURATION.slow, ease: EASE_SMOOTH }}
                />
              );
            })}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
