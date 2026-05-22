import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { playlistManager } from '../../../lib/playlists';
import { THEMES } from '../../../data/themes';
import { useTelegram } from '../../../hooks/useTelegram';
import styles from './Kahoot.module.css';

function themeLabel(themeId: string): string {
  return THEMES.find((t) => t.id === themeId)?.title ?? themeId;
}

function pickRandom<T>(list: T[], count: number): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(copy.length, count));
}

export function KahootPlaylistDetails() {
  const navigate = useNavigate();
  const { playlistId } = useParams<{ playlistId: string }>();
  const { userId } = useTelegram();
  const [version, setVersion] = useState(0);

  const playlist = useMemo(
    () => (playlistId ? playlistManager.getPlaylist(playlistId) : undefined),
    [playlistId, version],
  );

  if (!playlist) {
    return (
      <section className={styles.page}>
        <Link to="/play/kahoot/playlists" className={styles.back}>
          ← Плейлисти
        </Link>
        <p className={styles.error}>Плейлист не знайдено</p>
      </section>
    );
  }

  const isMine = playlist.creatorId === userId;

  const handleLike = () => {
    playlistManager.likePlaylist(playlist.id);
    setVersion((v) => v + 1);
  };

  const handlePlay = () => {
    playlistManager.registerPlay(playlist.id);
    const subset = pickRandom(playlist.questions, Math.min(20, Math.max(3, playlist.questions.length)));
    const qs = new URLSearchParams({ playlistId: playlist.id, q: subset.join(',') });
    navigate(`/play/kahoot/create?${qs.toString()}`);
  };

  return (
    <section className={styles.page}>
      <Link to="/play/kahoot/playlists" className={styles.back}>
        ← Плейлисти
      </Link>

      <header className={styles.playlistHeader}>
        <div>
          <h1 className={styles.title}>{playlist.name}</h1>
          <p className={styles.muted}>{playlist.description}</p>
          <p className={styles.playlistInfo}>
            {playlist.isPublic ? '🌍 Публічний' : '🔒 Приватний'} · Автор: {playlist.creatorName} · {playlist.plays} ігор ·{' '}
            {playlist.likes} лайків
          </p>
          <p className={styles.playlistInfo}>
            Теми: {playlist.themes.length ? playlist.themes.map(themeLabel).join(', ') : '—'} · Питань: {playlist.questions.length}
          </p>
        </div>
        <div className={styles.playlistActions}>
          {isMine ? (
            <Link to={`/play/kahoot/playlists/${playlist.id}/edit`} className={styles.btnSecondary}>
              Редагувати
            </Link>
          ) : (
            <button type="button" className={styles.btnSecondary} onClick={handleLike}>
              👍 Лайк
            </button>
          )}
        </div>
      </header>

      <button type="button" className={styles.btnPrimary} onClick={handlePlay}>
        Грати Kahoot з цим плейлистом
      </button>

      <article className={styles.hint}>
        <h3>Порада</h3>
        <p className={styles.muted}>
          Для швидкого старту береться випадкова підбірка до 20 питань із плейлисту.
        </p>
      </article>
    </section>
  );
}
