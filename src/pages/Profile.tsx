import { Link } from 'react-router-dom';
import { THEMES } from '../data/themes';
import { usePlayer } from '../context/PlayerContext';
import { useTelegram } from '../hooks/useTelegram';
import { DIFFICULTY_LABELS } from '../types';
import { ACHIEVEMENTS } from '../data/achievements';
import { COSMETIC_THEMES, getAvatarById } from '../data/cosmetics';
import { STUDY_THEME_GROUPS } from '../data/study_themes';
import styles from './Profile.module.css';

export function Profile() {
  const { profile, setActiveTheme, purchaseTheme } = usePlayer();
  const { displayName, userId } = useTelegram();

  const themeProgress = THEMES.map((theme) => ({
    theme,
    points: profile.themePoints[theme.id] ?? 0,
    levels: profile.completedLevels.filter((l) => l.themeId === theme.id),
  })).filter((t) => t.points > 0 || t.levels.length > 0);

  const handleSelectTheme = (themeId: string) => {
    setActiveTheme(themeId);
  };

  const handleBuyTheme = (themeId: string) => {
    const result = purchaseTheme(themeId);
    if (!result.purchased) {
      if (result.reason === 'points') {
        alert('Недостатньо очок для придбання цієї теми!');
      }
    }
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.avatar}>
          {profile.avatar ? (getAvatarById(profile.avatar)?.emoji ?? '📖') : '📖'}
        </div>
        <h1>{displayName}</h1>
        <p className={styles.id}>ID: {userId}</p>
      </header>

      <section className={styles.statsGrid}>
        <article className={styles.statsCard}>
          <span className={styles.statsLabel}>Очки</span>
          <strong className={styles.statsValue}>{profile.totalPoints}</strong>
        </article>
        <article className={styles.statsCard}>
          <span className={styles.statsLabel}>Монети</span>
          <strong className={styles.statsValue}>{profile.coins}</strong>
        </article>
        <article className={styles.statsCard}>
          <span className={styles.statsLabel}>Мільйонер</span>
          <strong className={styles.statsValue}>{profile.millionaireWins}</strong>
        </article>
      </section>

      <div className={styles.profileActions}>
        <Link to="/stats" className={styles.actionBtn}>🏆 Загальний Рейтинг</Link>
      </div>

      {/* Розділ Досягнень */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>🏆 Кабінет досягнень</h2>
        <div className={styles.achievementsGrid}>
          {ACHIEVEMENTS.map((ach) => {
            const isUnlocked = profile.achievements.includes(ach.id);
            return (
              <div
                key={ach.id}
                className={`${styles.achievementItem} ${isUnlocked ? styles.achUnlocked : styles.achLocked}`}
                title={ach.description}
              >
                <span className={styles.achIcon}>{ach.icon}</span>
                <div className={styles.achMeta}>
                  <h3>{ach.title}</h3>
                  <p>{ach.description}</p>
                </div>
                {!isUnlocked && <span className={styles.lockBadge}>🔒</span>}
              </div>
            );
          })}
        </div>
      </section>

      {/* Магазин Біблійних Тем */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>🎨 Магазин біблійних тем</h2>
        <p className={styles.sectionSubtitle}>
          Змінюй оформлення всієї гри відповідно до біблійних локацій
        </p>
        <div className={styles.themesShopGrid}>
          {COSMETIC_THEMES.map((theme) => {
            const isUnlocked = profile.unlockedThemes.includes(theme.id) || theme.price === 0;
            const isActive = profile.activeTheme === theme.id;

            return (
              <div
                key={theme.id}
                className={`${styles.shopThemeItem} ${isActive ? styles.themeActiveCard : ''}`}
              >
                {/* Колірна палітра-прев'ю */}
                <div
                  className={styles.themePalettePreview}
                  style={{ background: theme.preview.background }}
                >
                  <div
                    className={styles.paletteSurface}
                    style={{ background: theme.preview.surface }}
                  >
                    <span className={styles.paletteText} style={{ color: theme.preview.text }}>
                      Aa
                    </span>
                    <span className={styles.paletteAccent} style={{ background: theme.preview.accent }} />
                  </div>
                  <span className={styles.palettePrimary} style={{ background: theme.preview.primary }} />
                </div>

                <div className={styles.themeShopMeta}>
                  <h3>{theme.title}</h3>
                  <p>{theme.description}</p>

                  <div className={styles.themeShopAction}>
                    {isActive ? (
                      <span className={styles.badgeActive}>Активна</span>
                    ) : isUnlocked ? (
                      <button
                        type="button"
                        className={styles.btnApply}
                        onClick={() => handleSelectTheme(theme.id)}
                      >
                        Застосувати
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.btnPurchase}
                        onClick={() => handleBuyTheme(theme.id)}
                      >
                        Придбати ({theme.price} очок)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Mastery Heatmap */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>📈 Рівень знань (Mastery)</h2>
        <div className={styles.heatmapContainer}>
          <p className={styles.sectionSubtitle} style={{ margin: 0 }}>
            Чим темніший зелений, тим краще засвоєна тема.
          </p>
          <div className={styles.heatmapGrid}>
            {STUDY_THEME_GROUPS.flatMap((g) => g.subthemes).map((subtheme) => {
              const mastery = profile.studyMastery[subtheme.id]?.mastery || 0;
              let colorClass = styles.heatLevel0;
              if (mastery >= 80) colorClass = styles.heatLevel4;
              else if (mastery >= 60) colorClass = styles.heatLevel3;
              else if (mastery >= 40) colorClass = styles.heatLevel2;
              else if (mastery > 0) colorClass = styles.heatLevel1;

              return (
                <div
                  key={subtheme.id}
                  className={`${styles.heatCell} ${colorClass}`}
                  title={`${subtheme.title}: ${Math.round(mastery)}%`}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* Прогрес за темами */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>🗺️ Прогрес за темами</h2>
        {themeProgress.length === 0 ? (
          <p className={styles.empty}>
            Ще немає очок. Обери тематику та пройди перший рівень!
          </p>
        ) : (
          <ul className={styles.themeList}>
            {themeProgress.map(({ theme, points, levels }) => (
              <li key={theme.id} className={styles.themeItem}>
                <span className={styles.themeIcon}>{theme.icon}</span>
                <div className={styles.themeInfo}>
                  <strong>{theme.title}</strong>
                  <small>
                    {points} очок · {levels.length} рівн.
                    {levels.length > 0 &&
                      ` (${levels.map((l) => DIFFICULTY_LABELS[l.difficulty][0]).join(', ')})`}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>


    </section>
  );
}
