import { useMemo, useState } from 'react';
import { PlayerProfileModal } from '../components/PlayerProfileModal';
import { THEMES } from '../data/themes';
import { useResolvedProfile } from '../hooks/domain/useProfileWriter';
import { useGlobalStats } from '../queries/useGlobalStats';
import { useAuthSession } from '../context/AuthSessionContext';
import type { PlayerProfile } from '../types';
import { MotionStagger, MotionStaggerItem } from '../components/motion';
import { useMotionEntrance } from '../hooks/useMotionEntrance';
import { AppPage, PageHeader } from '../components/ui';
import styles from './GlobalStats.module.css';

type RankingTab = 'total' | 'survival' | 'millionaire';

function getRankValue(profile: PlayerProfile, tab: RankingTab): number {
  if (tab === 'survival') return profile.survivalHighScore;
  if (tab === 'millionaire') return profile.millionaireWins * 100 + profile.millionaireMaxLevel;
  return profile.coins;
}

function getRankMeta(profile: PlayerProfile, tab: RankingTab): string {
  if (tab === 'survival') return `${profile.survivalHighScore} правильних у найкращому забігу`;
  if (tab === 'millionaire') {
    return `${profile.millionaireWins} перемог · максимум ${profile.millionaireMaxLevel}/15`;
  }
  return `${profile.completedLevels.length} рівнів · ${Object.keys(profile.themePoints).length} тем`;
}

export function GlobalStats() {
  const { shouldEnter } = useMotionEntrance('global-stats');
  const { userId } = useAuthSession();
  const profile = useResolvedProfile();
  const { globalStats, refreshStats } = useGlobalStats(userId);
  const [activeTab, setActiveTab] = useState<RankingTab>('total');
  const [selectedProfile, setSelectedProfile] = useState<PlayerProfile | null>(null);

  const rankedPlayers = useMemo(() => [profile], [profile]);

  const grandTotal = THEMES.reduce(
    (sum, theme) => sum + (globalStats.themes[theme.id]?.totalPoints ?? 0),
    0,
  );

  return (
    <AppPage>
      <PageHeader
        kicker="Прогрес"
        title="Рейтинг гравців"
        description="Поки що тут лише твій профіль — глобальний рейтинг з'явиться після підключення бекенду."
        action={
          <button type="button" className={styles.refresh} onClick={refreshStats}>
            Оновити
          </button>
        }
      />

      <article className={styles.grandTotal}>
        <span>Очок у статистиці тем</span>
        <strong>{grandTotal}</strong>
      </article>

      <div className={styles.tabs} role="tablist" aria-label="Тип рейтингу">
        <button
          type="button"
          className={activeTab === 'total' ? styles.activeTab : ''}
          onClick={() => setActiveTab('total')}
        >
          Загальний
        </button>
        <button
          type="button"
          className={activeTab === 'survival' ? styles.activeTab : ''}
          onClick={() => setActiveTab('survival')}
        >
          Виживання
        </button>
        <button
          type="button"
          className={activeTab === 'millionaire' ? styles.activeTab : ''}
          onClick={() => setActiveTab('millionaire')}
        >
          Мільйонер
        </button>
      </div>

      <MotionStagger as="ul" className={styles.list} enter={shouldEnter}>
        {rankedPlayers.map((item, rank) => {
          const maxValue = getRankValue(rankedPlayers[0], activeTab) || 1;
          const value = getRankValue(item, activeTab);
          const width = value > 0 ? (value / maxValue) * 100 : 0;
          const isCurrentPlayer = item.userId === profile.userId;

          return (
            <MotionStaggerItem as="li" key={item.userId}>
              <button
                type="button"
                className={`${styles.item} ${isCurrentPlayer ? styles.currentPlayer : ''}`}
                onClick={() => setSelectedProfile(item)}
              >
                <span className={styles.rank}>#{rank + 1}</span>
                <span className={styles.icon}>📖</span>
                <span className={styles.info}>
                  <strong>{item.displayName}</strong>
                  <span className={styles.bar}>
                    <span style={{ width: `${width}%` }} />
                  </span>
                  <small>{getRankMeta(item, activeTab)}</small>
                </span>
                <span className={styles.points}>{value}</span>
              </button>
            </MotionStaggerItem>
          );
        })}
      </MotionStagger>

      <p className={styles.note}>
        Рейтинг поки що локальний і показує тільки твій профіль. Порівняння з іншими
        гравцями з'явиться, коли буде підключено бекенд.
      </p>

      {selectedProfile && (
        <PlayerProfileModal
          profile={selectedProfile}
          open={Boolean(selectedProfile)}
          onClose={() => setSelectedProfile(null)}
        />
      )}
    </AppPage>
  );
}
