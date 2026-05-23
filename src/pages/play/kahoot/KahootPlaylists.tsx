import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../../components/Icon';
import { playlistManager } from '../../../lib/playlists';
import { THEMES } from '../../../data/themes';
import { useTelegram } from '../../../hooks/useTelegram';
import styles from './Kahoot.module.css';

type TabId = 'mine' | 'public';

function themeLabel(themeId: string): string {
  return THEMES.find((t) => t.id === themeId)?.title ?? themeId;
}

export function KahootPlaylists() {
  const { userId } = useTelegram();
  const [tab, setTab] = useState<TabId>('mine');
  const [version, setVersion] = useState(0);

  const data = useMemo(() => {
    const mine = playlistManager.getUserPlaylists(userId).sort((a, b) => b.plays - a.plays);
    const pub = playlistManager.getPublicPlaylists().sort((a, b) => b.plays - a.plays);
    return { mine, pub };
  }, [userId, version]);

  const list = tab === 'mine' ? data.mine : data.pub;

  const handleDelete = (playlistId: string) => {
    const ok = window.confirm('Видалити плейлист?');
    if (!ok) return;
    playlistManager.deletePlaylist(playlistId, userId);
    setVersion((v) => v + 1);
  };

  const handleLike = (playlistId: string) => {
    playlistManager.likePlaylist(playlistId);
    setVersion((v) => v + 1);
  };

  return (
    <section className={styles.page}>
      <div className={styles.topRow}>
        <Link to="/play/kahoot" className={styles.backBtn} aria-label="Назад">
          <Icon name="back" size={20} />
        </Link>
      </div>

      <h1 className={styles.pageTitle}>Плейлисти</h1>

      <div className={styles.segmentControl}>
        <button
          type="button"
          className={`${styles.segmentTab} ${tab === 'mine' ? styles.segmentActive : ''}`}
          onClick={() => setTab('mine')}
        >
          Мої
        </button>
        <button
          type="button"
          className={`${styles.segmentTab} ${tab === 'public' ? styles.segmentActive : ''}`}
          onClick={() => setTab('public')}
        >
          Публічні
        </button>
        <span className={`${styles.segmentGlider} ${tab === 'mine' ? styles.gliderLeft : styles.gliderRight}`} />
      </div>

      {tab === 'mine' && (
        <Link to="/play/kahoot/playlists/new" className={styles.createButton}>
          + Створити плейлист
        </Link>
      )}

      {list.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📜</span>
          <strong className={styles.emptyTitle}>Тут порожньо</strong>
          <p className={styles.emptyDesc}>
            {tab === 'mine'
              ? 'Створи свій перший плейлист, щоб зіграти Kahoot за власними правилами!'
              : 'Публічних плейлистів поки немає. Створи свій і поділися ним!'}
          </p>
        </div>
      ) : (
        <ul className={styles.playlistList}>
          {list.map((p) => {
            const isMine = p.creatorId === userId;
            return (
              <li key={p.id} className={styles.playlistCard}>
                <div className={styles.playlistMeta}>
                  <Link to={`/play/kahoot/playlists/${p.id}`} className={styles.playlistTitle}>
                    {p.name}
                  </Link>
                  <p className={styles.playlistDesc}>{p.description}</p>
                  <p className={styles.playlistInfo}>
                    {p.isPublic ? '🌍 Публічний' : '🔒 Приватний'} · {p.plays} ігор · {p.likes} лайків ·{' '}
                    {p.themes.length ? p.themes.map(themeLabel).join(', ') : 'Без тем'}
                  </p>
                </div>

                <div className={styles.playlistActions}>
                  {isMine ? (
                    <>
                      <Link to={`/play/kahoot/playlists/${p.id}/edit`} className={styles.miniBtn}>
                        ✏️
                      </Link>
                      <button
                        type="button"
                        className={styles.miniBtn}
                        onClick={() => handleDelete(p.id)}
                      >
                        🗑️
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={styles.miniBtn}
                      onClick={() => handleLike(p.id)}
                    >
                      👍
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

