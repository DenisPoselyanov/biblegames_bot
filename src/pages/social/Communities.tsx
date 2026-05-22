import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTelegram } from '../../hooks/useTelegram';
import { communityManager } from '../../lib/communities';
import styles from './Social.module.css';

export function Communities() {
  const navigate = useNavigate();
  const { userId } = useTelegram();
  const [version, setVersion] = useState(0);

  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const data = useMemo(() => {
    const profile = communityManager.getSocialProfile(userId);
    const mine = communityManager.getUserCommunities(userId);
    const results = query.trim() ? communityManager.searchCommunities(query.trim()) : communityManager.getPublicCommunities();
    return { profile, mine, results };
  }, [userId, query, version]);

  const handleCreate = () => {
    setError(null);
    if (!name.trim()) {
      setError('Вкажіть назву спільноти');
      return;
    }
    if (!description.trim()) {
      setError('Вкажіть опис');
      return;
    }
    const c = communityManager.createCommunity(name.trim(), description.trim(), userId, isPublic);
    setName('');
    setDescription('');
    setIsPublic(true);
    setVersion((v) => v + 1);
    navigate(`/social/communities/${c.id}`);
  };

  const handleJoin = (communityId: string) => {
    communityManager.joinCommunity(communityId, userId);
    setVersion((v) => v + 1);
  };

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Спільноти</h1>
          <p className={styles.muted}>Створи власну або приєднайся до публічної</p>
        </div>
        <Link to="/profile" className={styles.btnSecondary}>
          Профіль
        </Link>
      </div>

      <section className={styles.card}>
        <h2 className={styles.title} style={{ fontSize: '1.1rem' }}>
          Створити спільноту
        </h2>

        <label className={styles.field}>
          <span>Назва</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Наприклад: Молодь Київ" />
        </label>
        <label className={styles.field}>
          <span>Опис</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} placeholder="Короткий опис" />
        </label>

        <label className={styles.field}>
          <span>Доступ</span>
          <select value={isPublic ? 'public' : 'private'} onChange={(e) => setIsPublic(e.target.value === 'public')}>
            <option value="public">Публічна</option>
            <option value="private">Приватна</option>
          </select>
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <button type="button" className={styles.btnPrimary} onClick={handleCreate}>
          Створити
        </button>
      </section>

      <section className={styles.card}>
        <div className={styles.row}>
          <h2 className={styles.title} style={{ fontSize: '1.1rem' }}>
            Мої спільноти
          </h2>
          <span className={styles.badge}>{data.mine.length}</span>
        </div>
        {data.mine.length === 0 ? (
          <p className={styles.muted}>Поки що немає</p>
        ) : (
          <ul className={styles.list}>
            {data.mine.map((c) => (
              <li key={c.id} className={styles.row}>
                <div>
                  <Link to={`/social/communities/${c.id}`} className={styles.link}>
                    {c.name}
                  </Link>
                  <p className={styles.muted}>{c.description}</p>
                </div>
                <span className={styles.badge}>{c.memberIds.length} 👥</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card}>
        <label className={styles.field}>
          <span>Пошук публічних спільнот</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Введіть назву або опис" />
        </label>

        {data.results.length === 0 ? (
          <p className={styles.muted}>Нічого не знайдено</p>
        ) : (
          <ul className={styles.list}>
            {data.results.map((c) => {
              const isMember = data.profile.communities.includes(c.id);
              return (
                <li key={c.id} className={styles.row}>
                  <div>
                    <Link to={`/social/communities/${c.id}`} className={styles.link}>
                      {c.name}
                    </Link>
                    <p className={styles.muted}>{c.description}</p>
                  </div>
                  {isMember ? (
                    <span className={styles.badge}>Учасник</span>
                  ) : (
                    <button type="button" className={styles.miniBtn} onClick={() => handleJoin(c.id)}>
                      Приєднатись
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}
