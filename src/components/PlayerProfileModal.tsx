import { ACHIEVEMENTS } from '../data/achievements';
import { THEMES } from '../data/themes';
import type { PlayerProfile } from '../types';
import styles from './PlayerProfileModal.module.css';

interface PlayerProfileModalProps {
  profile: PlayerProfile;
  open: boolean;
  onClose: () => void;
}

function getLevel(totalPoints: number): number {
  return Math.max(1, Math.floor(totalPoints / 250) + 1);
}

export function PlayerProfileModal({ profile, open, onClose }: PlayerProfileModalProps) {
  if (!open) return null;

  const unlockedAchievements = ACHIEVEMENTS.filter((achievement) =>
    profile.achievements.includes(achievement.id),
  );

  const topThemes = THEMES.map((theme) => ({
    theme,
    points: profile.themePoints[theme.id] ?? 0,
  }))
    .filter((item) => item.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <article
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-profile-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <span className={styles.avatar}>📖</span>
          <div>
            <h2 id="player-profile-title">{profile.displayName}</h2>
            <p>Рівень {getLevel(profile.totalPoints)} · {profile.totalPoints} очок</p>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Закрити">
            ×
          </button>
        </header>

        <section className={styles.statsGrid}>
          <span>
            <strong>{profile.survivalHighScore}</strong>
            Виживання
          </span>
          <span>
            <strong>{profile.millionaireWins}</strong>
            Перемоги
          </span>
          <span>
            <strong>{profile.millionaireMaxLevel}/15</strong>
            Мільйонер
          </span>
        </section>

        <section className={styles.section}>
          <h3>Досягнення</h3>
          {unlockedAchievements.length > 0 ? (
            <ul className={styles.achievements}>
              {unlockedAchievements.map((achievement) => (
                <li key={achievement.id} title={achievement.description}>
                  <span>{achievement.icon}</span>
                  {achievement.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>Ще немає відкритих досягнень.</p>
          )}
        </section>

        <section className={styles.section}>
          <h3>Найсильніші теми</h3>
          {topThemes.length > 0 ? (
            <ul className={styles.themes}>
              {topThemes.map(({ theme, points }) => (
                <li key={theme.id}>
                  <span>{theme.icon} {theme.title}</span>
                  <strong>{points}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>Тематичний прогрес ще порожній.</p>
          )}
        </section>
      </article>
    </div>
  );
}
