import { useMemo, useState } from 'react';
import { PlayerProfileModal } from '../components/PlayerProfileModal';
import { THEMES } from '../data/themes';
import { usePlayer } from '../context/PlayerContext';
import type { PlayerProfile } from '../types';
import styles from './GlobalStats.module.css';

type RankingTab = 'total' | 'survival' | 'millionaire';

const VIRTUAL_PLAYERS: PlayerProfile[] = [
  {
    userId: 'virtual-apollos',
    displayName: 'Аполлос',
    totalPoints: 2420,
    themePoints: { paul: 760, 'new-testament': 520, gospels: 430, psalms: 220 },
    completedLevels: [],
    survivalHighScore: 42,
    millionaireWins: 2,
    millionaireMaxLevel: 15,
    unlockedThemes: ['classic', 'heavenly-jerusalem'],
    activeTheme: 'heavenly-jerusalem',
    achievements: ['biblical-millionaire', 'iron-shield', 'aesthete'],
    avatar: 'default',
    coins: 1800,
    unlockedAvatars: ['default'],
    streakDays: 4,
    lastActiveAt: new Date().toISOString(),
    studyMastery: {},
  },
  {
    userId: 'virtual-moses',
    displayName: 'Мойсей',
    totalPoints: 2180,
    themePoints: { 'mosaic-law': 920, commandments: 540, geography: 310 },
    completedLevels: [],
    survivalHighScore: 35,
    millionaireWins: 1,
    millionaireMaxLevel: 14,
    unlockedThemes: ['classic', 'sinai-revelation'],
    activeTheme: 'sinai-revelation',
    achievements: ['iron-shield', 'cartographer'],
    avatar: 'default',
    coins: 1450,
    unlockedAvatars: ['default'],
    streakDays: 6,
    lastActiveAt: new Date().toISOString(),
    studyMastery: {},
  },
  {
    userId: 'virtual-miriam',
    displayName: 'Маріам',
    totalPoints: 1740,
    themePoints: { psalms: 610, 'old-testament': 420, patriarchs: 260 },
    completedLevels: [],
    survivalHighScore: 28,
    millionaireWins: 0,
    millionaireMaxLevel: 12,
    unlockedThemes: ['classic', 'eden-garden'],
    activeTheme: 'eden-garden',
    achievements: ['aesthete'],
    avatar: 'default',
    coins: 960,
    unlockedAvatars: ['default'],
    streakDays: 2,
    lastActiveAt: new Date().toISOString(),
    studyMastery: {},
  },
  {
    userId: 'virtual-luke',
    displayName: 'Лука',
    totalPoints: 1510,
    themePoints: { gospels: 700, miracles: 480, 'new-testament': 190 },
    completedLevels: [],
    survivalHighScore: 24,
    millionaireWins: 1,
    millionaireMaxLevel: 15,
    unlockedThemes: ['classic', 'gennesaret-sea'],
    activeTheme: 'gennesaret-sea',
    achievements: ['biblical-millionaire'],
    avatar: 'default',
    coins: 1100,
    unlockedAvatars: ['default'],
    streakDays: 7,
    lastActiveAt: new Date().toISOString(),
    studyMastery: {},
  },
];

function getRankValue(profile: PlayerProfile, tab: RankingTab): number {
  if (tab === 'survival') return profile.survivalHighScore;
  if (tab === 'millionaire') return profile.millionaireWins * 100 + profile.millionaireMaxLevel;
  return profile.totalPoints;
}

function getRankMeta(profile: PlayerProfile, tab: RankingTab): string {
  if (tab === 'survival') return `${profile.survivalHighScore} правильних у найкращому забігу`;
  if (tab === 'millionaire') {
    return `${profile.millionaireWins} перемог · максимум ${profile.millionaireMaxLevel}/15`;
  }
  return `${profile.completedLevels.length} рівнів · ${Object.keys(profile.themePoints).length} тем`;
}

export function GlobalStats() {
  const { profile, globalStats, refreshStats } = usePlayer();
  const [activeTab, setActiveTab] = useState<RankingTab>('total');
  const [selectedProfile, setSelectedProfile] = useState<PlayerProfile | null>(null);

  const players = useMemo(() => [profile, ...VIRTUAL_PLAYERS], [profile]);
  const rankedPlayers = useMemo(
    () =>
      [...players].sort(
        (a, b) =>
          getRankValue(b, activeTab) - getRankValue(a, activeTab) ||
          b.totalPoints - a.totalPoints,
      ),
    [activeTab, players],
  );

  const grandTotal = THEMES.reduce(
    (sum, theme) => sum + (globalStats.themes[theme.id]?.totalPoints ?? 0),
    0,
  );

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Рейтинг гравців</h1>
        <p>Локальна таблиця з твоїм профілем і віртуальними біблійними суперниками</p>
        <button type="button" className={styles.refresh} onClick={refreshStats}>
          Оновити
        </button>
      </header>

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

      <ul className={styles.list}>
        {rankedPlayers.map((item, rank) => {
          const maxValue = getRankValue(rankedPlayers[0], activeTab) || 1;
          const value = getRankValue(item, activeTab);
          const width = value > 0 ? (value / maxValue) * 100 : 0;
          const isCurrentPlayer = item.userId === profile.userId;

          return (
            <li key={item.userId}>
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
            </li>
          );
        })}
      </ul>

      <p className={styles.note}>
        Це локальна демонстрація рейтингу. Пізніше її можна під’єднати до backend API
        для справжньої глобальної таблиці.
      </p>

      {selectedProfile && (
        <PlayerProfileModal
          profile={selectedProfile}
          open={Boolean(selectedProfile)}
          onClose={() => setSelectedProfile(null)}
        />
      )}
    </section>
  );
}
