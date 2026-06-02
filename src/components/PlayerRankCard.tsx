import { DIFFICULTIES, DIFFICULTY_LABELS, DIFFICULTY_ORDER } from '../types';
import type { PlayerRank } from '../types';
import {
  computeWisdomProgress,
  formatRankLabel,
  isGlobalRankAchieved,
} from '../lib/practiceProgression';
import styles from './PlayerRankCard.module.css';

const RANK_EMOJIS: Record<string, string> = {
  baby: '👶',
  child: '🧒',
  youth: '🧑',
  student: '🎓',
  preacher: '📖',
  teacher: '👨‍🏫',
  theologian: '⛪',
};

interface PlayerRankCardProps {
  playerRank: PlayerRank;
}

export function PlayerRankCard({ playerRank }: PlayerRankCardProps) {
  const progress = computeWisdomProgress(playerRank);
  const progressPct =
    progress.required > 0 ? Math.min(100, Math.round((progress.current / progress.required) * 100)) : 100;

  return (
    <section className={styles.card} aria-label="Мій шлях розвитку">
      <div className={styles.header}>
        <h2 className={styles.title}>Мій шлях</h2>
        <span className={styles.rankBadge}>
          {formatRankLabel(playerRank.tier, playerRank.plaque)}
        </span>
      </div>

      <p className={styles.wisdom}>
        Очки мудрості: <strong>{playerRank.wisdomPoints}</strong>
      </p>

      <div className={styles.progressLabel}>
        <span>{progress.label}</span>
        <span>
          {progress.required > 0 ? `${progress.current} / ${progress.required}` : 'Максимум'}
        </span>
      </div>
      <div className={styles.progressBar} role="progressbar" aria-valuenow={progressPct}>
        <span style={{ width: `${progressPct}%` }} />
      </div>

      <div className={styles.roadmap} aria-label="Дорожня карта рангів">
        {DIFFICULTIES.map((tier) => {
          const achieved = isGlobalRankAchieved(playerRank, tier);
          const isCurrent = playerRank.tier === tier;
          let stepClass = styles.roadStep;
          if (achieved) stepClass += ` ${styles.roadStepDone}`;
          else if (isCurrent) stepClass += ` ${styles.roadStepCurrent}`;
          else stepClass += ` ${styles.roadStepUpcoming}`;

          return (
            <div key={tier} className={stepClass}>
              <span className={styles.roadEmoji}>{RANK_EMOJIS[tier]}</span>
              <span className={styles.roadName}>{DIFFICULTY_LABELS[tier]}</span>
              {isCurrent && (
                <span className={styles.roadName}>{DIFFICULTY_ORDER[tier] + 1}/7</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
