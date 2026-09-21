import { useMotionCapabilities } from '../motion';
import styles from './ShellAurora.module.css';

/**
 * Aurora/gradient background treatment (WS2,
 * `PHASE_3_5_DESIGN_V2_VISUAL_MIGRATION.md` §6 WS2). Three blurred, drifting
 * radial-gradient blobs plus a fine grain layer, ported from
 * `proto/design-v2`'s `.proto-aurora`/`.proto-grain`. Reads `--aurora-1/2/3`
 * (`deriveSemanticPalette`) rather than hardcoding colors, so it is
 * theme-driven: on every pre-existing theme those tokens default to
 * `transparent` (`cosmeticTheme.ts`) and this layer renders invisibly — only
 * `aurora`/`aurora-light` pin real values. Only mounted by `AppShellV2` when
 * `designSystemV2` is on, so the flag stays the rollback switch either way.
 *
 * Drift animation gates on `effectiveIntensity`, not a raw
 * `prefers-reduced-motion` query — consistent with Phase 3 WS4's motion
 * contract (§24/§25) rather than a second, parallel reduced-motion check.
 */
export function ShellAurora() {
  const { effectiveIntensity } = useMotionCapabilities();
  const still = effectiveIntensity === 'minimal';

  return (
    <div className={styles.aurora} aria-hidden="true">
      <span className={styles.blob1} data-still={still || undefined} />
      <span className={styles.blob2} data-still={still || undefined} />
      <span className={styles.blob3} data-still={still || undefined} />
      <span className={styles.grain} />
    </div>
  );
}
