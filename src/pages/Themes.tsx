import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { STUDY_THEME_GROUPS } from '../data/study_themes';
import { getThemeById } from '../data/themes';
import { ThemeCard } from '../components/ThemeCard';
import { usePlayer } from '../context/PlayerContext';
import { trackEvent } from '../lib/telemetry';
import { Icon } from '../components/Icon';
import styles from './Themes.module.css';

export function Themes() {
  const { profile } = usePlayer();
  const [groupId, setGroupId] = useState<string | null>(null);

  const activeGroup = useMemo(
    () => STUDY_THEME_GROUPS.find((group) => group.id === groupId) ?? null,
    [groupId],
  );
  const subThemes = useMemo(
    () =>
      (activeGroup?.subthemes ?? [])
        .map((entry) => getThemeById(entry.themeId))
        .filter((theme): theme is NonNullable<typeof theme> => Boolean(theme)),
    [activeGroup],
  );

  const handleOpenGroup = (nextGroupId: string) => {
    setGroupId(nextGroupId);
    trackEvent('study_path_advanced', { groupId: nextGroupId, step: 'open-group' });
  };

  return (
    <section className={styles.page}>
      <div className={styles.topRow}>
        <Link to="/play/study" className={styles.backBtn} aria-label="Назад">
          <Icon name="back" size={20} />
        </Link>
        <div className={styles.topChips}>
          <span className={styles.chip}>📖 Дослідження</span>
        </div>
      </div>

      <header className={styles.header}>
        <h1>{!activeGroup ? 'Обери тематику' : activeGroup.title}</h1>
        <p>{!activeGroup ? 'Оберіть загальну тему, а потім заглиблюйтесь у підтеми' : activeGroup.description}</p>
      </header>

      {!activeGroup ? (
        <ul className={styles.grid}>
          {STUDY_THEME_GROUPS.map((group) => (
            <li key={group.id}>
              <button type="button" className={styles.groupCard} onClick={() => handleOpenGroup(group.id)}>
                <span className={styles.groupIcon}>{group.icon}</span>
                <div className={styles.groupBody}>
                  <span className={styles.groupTitle}>{group.title}</span>
                  <span className={styles.groupDesc}>{group.description}</span>
                  <span className={styles.groupMeta}>{group.subthemes.length} підтеми</span>
                </div>
                <span className={styles.groupArrow}>→</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className={styles.groupHeader}>
            <button type="button" className={styles.backToGroups} onClick={() => setGroupId(null)}>
              <Icon name="back" size={16} />
              До загальних тем
            </button>
          </div>
          <ul className={styles.grid}>
            {subThemes.map((theme) => (
              <li key={theme.id}>
                <ThemeCard
                  theme={theme}
                  points={profile.themePoints[theme.id]}
                  mastery={profile.studyMastery[theme.id]?.mastery ?? 0}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
