import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../../context/PlayerContext';
import { THEMES } from '../../data/themes';
import { useTelegram } from '../../hooks/useTelegram';
import { friendChallengeManager } from '../../lib/friendChallenges';
import { DIFFICULTIES, DIFFICULTY_LABELS, type Difficulty } from '../../types';
import styles from './Social.module.css';

export function Challenges() {
  const { userId, displayName } = useTelegram();
  const { profile } = usePlayer();
  const [version, setVersion] = useState(0);

  const [friendId, setFriendId] = useState('');
  const [friendName, setFriendName] = useState('');
  const [themeId, setThemeId] = useState<string>('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [error, setError] = useState<string | null>(null);

  const data = useMemo(() => {
    friendChallengeManager.cleanupExpiredChallenges();
    const { sent, received } = friendChallengeManager.getUserChallenges(userId);
    const pending = friendChallengeManager.getPendingChallenges(userId);
    const history = friendChallengeManager.getChallengeHistory(userId, 20);
    return { sent, received, pending, history };
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
    setDifficulty('medium');
    setVersion((v) => v + 1);
  };

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Виклики друзів</h1>
          <p className={styles.muted}>Створи виклик або прийми отриманий</p>
        </div>
        <Link to="/profile" className={styles.btnSecondary}>
          Профіль
        </Link>
      </div>

      <section className={styles.card}>
        <div className={styles.row}>
          <h2 className={styles.title} style={{ fontSize: '1.1rem' }}>
            Новий виклик
          </h2>
          <span className={styles.badge}>24h</span>
        </div>

        <div className={styles.field}>
          <span>ID друга</span>
          <input value={friendId} onChange={(e) => setFriendId(e.target.value)} placeholder="Наприклад: 123456" />
        </div>
        <div className={styles.field}>
          <span>Імʼя друга</span>
          <input value={friendName} onChange={(e) => setFriendName(e.target.value)} placeholder="Наприклад: Андрій" />
        </div>

        <div className={styles.row}>
          <label className={styles.field} style={{ flex: 1 }}>
            <span>Тема (опційно)</span>
            <select value={themeId} onChange={(e) => setThemeId(e.target.value)}>
              <option value="">Будь-яка</option>
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field} style={{ flex: 1 }}>
            <span>Складність</span>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="button" className={styles.btnPrimary} onClick={handleCreate}>
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
          <p className={styles.muted}>Немає активних викликів</p>
        ) : (
          <ul className={styles.list}>
            {data.pending.map((c) => (
              <li key={c.id} className={styles.row}>
                <div>
                  <Link to={`/social/challenges/${c.id}`} className={styles.link}>
                    {c.challengerName} → ти
                  </Link>
                  <p className={styles.muted}>
                    {c.themeId ? `Тема: ${c.themeId}` : 'Будь-яка тема'} · {c.difficulty ? DIFFICULTY_LABELS[c.difficulty] : '—'}
                  </p>
                </div>
                <span className={styles.badge}>PENDING</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.title} style={{ fontSize: '1.1rem' }}>
          Історія
        </h2>
        {data.history.length === 0 ? (
          <p className={styles.muted}>Поки що порожньо</p>
        ) : (
          <ul className={styles.list}>
            {data.history.map((c) => (
              <li key={c.id} className={styles.row}>
                <div>
                  <Link to={`/social/challenges/${c.id}`} className={styles.link}>
                    {c.challengerName} vs {c.challengedName}
                  </Link>
                  <p className={styles.muted}>
                    {c.status.toUpperCase()} · {c.challengerScore}:{c.challengedScore ?? '—'}
                  </p>
                </div>
                <span className={styles.badge}>{c.status.toUpperCase()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

