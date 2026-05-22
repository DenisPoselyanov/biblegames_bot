import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
      <Link to="/play/kahoot" className={styles.back}>
        ← Kahoot
      </Link>

      <div className={styles.playlistsTop}>
        <h1 className={styles.title}>Плейлисти</h1>
        <Link to="/play/kahoot/playlists/new" className={styles.btnSecondary}>
          + Створити
        </Link>
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === 'mine' ? styles.tabActive : ''}`}
          onClick={() => setTab('mine')}
        >
          Мої
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === 'public' ? styles.tabActive : ''}`}
          onClick={() => setTab('public')}
        >
          Публічні
        </button>
      </div>

      {list.length === 0 ? (
        <p className={styles.muted}>
          {tab === 'mine'
            ? 'Поки що немає плейлистів. Створи перший і зіграй Kahoot за ним.'
            : 'Поки що немає публічних плейлистів.'}
        </p>
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

