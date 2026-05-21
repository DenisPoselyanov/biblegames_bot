import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { STUDY_THEME_GROUPS } from '../data/study_themes';
import { getThemeById } from '../data/themes';
import { ThemeCard } from '../components/ThemeCard';
import { usePlayer } from '../context/PlayerContext';
import { trackEvent } from '../lib/telemetry';
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
      <Link to="/play" className={styles.back}>
        ← Режими
      </Link>
      <header className={styles.header}>
        <h1>Дослідження — тематики</h1>
        <p>Обери загальну тему, а потім заглиблюйся в підтеми</p>
      </header>

      {!activeGroup ? (
        <ul className={styles.grid}>
          {STUDY_THEME_GROUPS.map((group) => (
            <li key={group.id}>
              <button type="button" className={styles.groupCard} onClick={() => handleOpenGroup(group.id)}>
                <span className={styles.groupIcon}>{group.icon}</span>
                <span className={styles.groupBody}>
                  <strong>{group.title}</strong>
                  <small>{group.description}</small>
                </span>
                <span className={styles.groupArrow}>→</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className={styles.grid}>
          <li>
            <button type="button" className={styles.groupBack} onClick={() => setGroupId(null)}>
              ← До загальних тем
            </button>
          </li>
          {subThemes.map((theme) => (
            <li key={theme.id}>
              <ThemeCard theme={theme} points={profile.themePoints[theme.id]} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
