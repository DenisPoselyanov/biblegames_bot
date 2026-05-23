import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../../context/PlayerContext';
import { THEMES } from '../../data/themes';
import { useTelegram } from '../../hooks/useTelegram';
import { friendChallengeManager } from '../../lib/friendChallenges';
import { type Difficulty } from '../../types';
import { Icon } from '../../components/Icon';
import styles from './Social.module.css';

const CHALLENGE_DIFFICULTIES = [
  { label: 'Отрок', value: 'child' as Difficulty },
  { label: 'Юнак', value: 'youth' as Difficulty },
  { label: 'Старець', value: 'preacher' as Difficulty },
];

function getThemeTitle(id: string) {
  return THEMES.find((t) => t.id === id)?.title ?? id;
}

export function Challenges() {
  const { userId, displayName } = useTelegram();
  const { profile } = usePlayer();
  const [version, setVersion] = useState(0);

  const [friendId, setFriendId] = useState('');
  const [friendName, setFriendName] = useState('');
  const [themeId, setThemeId] = useState<string>('');
  const [difficulty, setDifficulty] = useState<Difficulty>('youth');
  const [error, setError] = useState<string | null>(null);

  const data = useMemo(() => {
    friendChallengeManager.cleanupExpiredChallenges();
    const { sent, received } = friendChallengeManager.getUserChallenges(userId);
    const pending = friendChallengeManager.getPendingChallenges(userId);
    const history = friendChallengeManager.getChallengeHistory(userId, 20);
    const stats = friendChallengeManager.getUserStats(userId);
    return { sent, received, pending, history, stats };
  }, [userId, version]);

  const handleCreate = () => {
    setError(null);
    if (!friendId.trim()) {
      setError('Вкажіть ID друга');
      return;
    }
    if (!friendName.trim()) {
      setError('Вкажіть імʼя друга');
      return;
    }

    friendChallengeManager.createChallenge(
      userId,
      displayName,
      profile.totalPoints,
      friendId.trim(),
      friendName.trim(),
      themeId ? { themeId, difficulty } : { difficulty },
    );
    setFriendId('');
    setFriendName('');
    setThemeId('');
    setDifficulty('youth');
    setVersion((v) => v + 1);
  };

  const handleAccept = (id: string) => {
    friendChallengeManager.acceptChallenge(id);
    setVersion((v) => v + 1);
  };

  const handleDecline = (id: string) => {
    friendChallengeManager.declineChallenge(id);
    setVersion((v) => v + 1);
  };

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to="/profile" className={styles.backBtn} aria-label="Назад">
            <Icon name="back" size={20} />
          </Link>
          <div>
            <h1 className={styles.title}>Виклики друзів</h1>
            <p className={styles.muted}>Кинь виклик або прийми отриманий</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.trophyWidget}>
            <Icon name="trophy" size={14} />
            <span>{data.stats.wins}</span>
          </div>
        </div>
      </div>

      <section className={styles.card}>
        <div className={styles.row}>
          <h2 className={styles.title} style={{ fontSize: '1.1rem' }}>
            Новий виклик
          </h2>
          <span className={styles.neonBadge}>24h</span>
        </div>

        <div className={styles.field}>
          <span>ID друга</span>
          <input
            value={friendId}
            onChange={(e) => setFriendId(e.target.value)}
            placeholder="Наприклад: 123456"
            className={styles.fieldInput}
          />
        </div>
        <div className={styles.field}>
          <span>Імʼя друга</span>
          <input
            value={friendName}
            onChange={(e) => setFriendName(e.target.value)}
            placeholder="Наприклад: Андрій"
            className={styles.fieldInput}
          />
        </div>

        <div className={styles.field}>
          <span>Складність</span>
          <div className={styles.chipGroup}>
            {CHALLENGE_DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                type="button"
                className={`${styles.chip} ${difficulty === d.value ? styles.chipActive : ''}`}
                onClick={() => setDifficulty(d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <span>Тема (опційно)</span>
          <div className={styles.themeRow}>
            <button
              type="button"
              className={`${styles.themeChip} ${themeId === '' ? styles.themeChipActive : ''}`}
              onClick={() => setThemeId('')}
            >
              Будь-яка
            </button>
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`${styles.themeChip} ${themeId === t.id ? styles.themeChipActive : ''}`}
                onClick={() => setThemeId(t.id)}
              >
                {t.icon} {t.title}
              </button>
            ))}
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="button" className={styles.btnFull} onClick={handleCreate}>
          <Icon name="challenge" size={18} />
          Створити виклик
        </button>
      </section>

      <section className={styles.card}>
        <div className={styles.row}>
          <h2 className={styles.title} style={{ fontSize: '1.1rem' }}>
            Отримані (очікують)
          </h2>
          <span className={styles.badge}>{data.pending.length}</span>
        </div>

        {data.pending.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>⚔️</span>
            <p className={styles.emptyText}>
              Твої друзі відпочивають. Кинь їм виклик першим!
            </p>
          </div>
        ) : (
          <ul className={styles.list}>
            {data.pending.map((c) => (
              <li key={c.id} className={styles.pendingItem}>
                <div className={styles.pendingAvatar}>
                  {c.challengerName.charAt(0).toUpperCase()}
                </div>
                <div className={styles.pendingInfo}>
                  <p className={styles.pendingName}>{c.challengerName}</p>
                  <p className={styles.pendingMeta}>
                    {c.themeId ? getThemeTitle(c.themeId) : 'Будь-яка тема'} · {c.difficulty ?? '—'}
                  </p>
                </div>
                <div className={styles.pendingActions}>
                  <button
                    type="button"
                    className={styles.btnAccept}
                    onClick={() => handleAccept(c.id)}
                  >
                    Прийняти
                  </button>
                  <button
                    type="button"
                    className={styles.btnDecline}
                    onClick={() => handleDecline(c.id)}
                  >
                    Відхилити
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.title} style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
          Історія
        </h2>
        {data.history.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📜</span>
            <p className={styles.emptyText}>Поки що порожньо</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {data.history.map((c) => {
              const isChallenger = c.challengerId === userId;
              const userWon =
                c.status === 'completed' &&
                ((isChallenger && (c.challengerScore || 0) > (c.challengedScore || 0)) ||
                  (!isChallenger && (c.challengedScore || 0) > (c.challengerScore || 0)));
              const opponentName = isChallenger ? c.challengedName : c.challengerName;
              const pointDiff = isChallenger
                ? Math.abs((c.challengerScore || 0) - (c.challengedScore || 0))
                : Math.abs((c.challengedScore || 0) - (c.challengerScore || 0));

              return (
                <li key={c.id} className={styles.historyItem}>
                  <div
                    className={`${styles.historyIcon} ${
                      c.status === 'completed'
                        ? userWon
                          ? styles.historyWin
                          : styles.historyLoss
                        : ''
                    }`}
                  >
                    {c.status === 'completed' ? (userWon ? '🏆' : '💔') : '⏳'}
                  </div>
                  <div className={styles.historyInfo}>
                    <p className={styles.historyTitle}>
                      {c.status === 'completed'
                        ? `${userWon ? 'Перемога' : 'Поразка'} проти ${opponentName}`
                        : `${c.challengerName} vs ${c.challengedName}`}
                    </p>
                    <p className={styles.historyMeta}>
                      {c.themeId ? getThemeTitle(c.themeId) : 'Будь-яка тема'}
                      {c.status === 'completed' && pointDiff > 0
                        ? ` · +${pointDiff} балів`
                        : ''}
                    </p>
                  </div>
                  <span className={styles.badge}>
                    {c.status === 'completed'
                      ? `${c.challengerScore}:${c.challengedScore}`
                      : c.status === 'declined'
                        ? 'ВІДХИЛЕНО'
                        : c.status.toUpperCase()}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}
