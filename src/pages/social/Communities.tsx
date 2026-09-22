import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTelegram } from '../../hooks/useTelegram';
import { communityManager } from '../../lib/communities';
import { Icon } from '../../components/Icon';
import { EmptyState } from '../../components/EmptyState';
import { isFeatureEnabled } from '../../lib/flags';
import { AppPage, Button, ContentCard, HeroCard, ListRow, PageHeader, Pill, SearchField } from '../../components/ui';
import { SocialTabs } from './SocialTabs';
import styles from './Social.module.css';

export function Communities() {
  const navigate = useNavigate();
  const { userId } = useTelegram();
  const [version, setVersion] = useState(0);
  const designSystemV2 = isFeatureEnabled('designSystemV2');

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

  const createFormFields = (
    <>
      <label className={styles.field}>
        <span>Назва</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Наприклад: Молодь Київ"
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span>Опис</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={120}
          placeholder="Короткий опис спільноти"
          className={styles.fieldInput}
        />
      </label>

      <div className={styles.field}>
        <span>Доступ</span>
        <div className={styles.accessCards}>
          <button
            type="button"
            className={`${styles.accessCard} ${isPublic ? styles.accessCardActive : ''}`}
            onClick={() => setIsPublic(true)}
          >
            <span className={styles.accessCardIcon}>🔓</span>
            <div>
              <p className={styles.accessCardTitle}>Публічна</p>
              <p className={styles.accessCardDesc}>Доєднатися може кожен</p>
            </div>
          </button>
          <button
            type="button"
            className={`${styles.accessCard} ${!isPublic ? styles.accessCardActive : ''}`}
            onClick={() => setIsPublic(false)}
          >
            <span className={styles.accessCardIcon}>🔒</span>
            <div>
              <p className={styles.accessCardTitle}>Приватна</p>
              <p className={styles.accessCardDesc}>Вхід лише за запрошенням</p>
            </div>
          </button>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </>
  );

  return (
    <AppPage>
      <PageHeader
        onBack={() => navigate(designSystemV2 ? '/play' : '/profile')}
        title={designSystemV2 ? 'Спільнота' : 'Спільноти'}
        description={
          designSystemV2 ? 'Разом вивчати легше, ніж самому' : 'Створи власну або приєднайся до публічної'
        }
      />

      {designSystemV2 && <SocialTabs active="communities" />}

      {/* §8 Phase 3.5 audit: illustrated hero banner leads the section — the
          screen had zero HeroCard/CoverArt use before this. Purely visual;
          the form below (unchanged) is still the actual action. */}
      {designSystemV2 && (
        <HeroCard
          tone="cover"
          coverSeed="communities-hero"
          coverGlyph="rays"
          coverHue={258}
          title="Своя група"
          description="Створи власну спільноту або приєднайся до публічної"
          footer={
            <Pill tone="onColor" icon={<Icon name="community" size={12} />}>
              {data.mine.length} приєднано
            </Pill>
          }
        />
      )}

      {/* Phase 3.5 WS6: `ContentCard` replaces the bespoke `.card` surface;
          the form fields themselves are token-driven already and shared
          between both branches (`createFormFields` above). */}
      {designSystemV2 ? (
        <ContentCard variant="compact">
          <h2 className={styles.title} style={{ fontSize: '1.1rem' }}>
            Створити спільноту
          </h2>
          {createFormFields}
          <Button fullWidth onClick={handleCreate}>
            <Icon name="community" size={18} />
            Створити
          </Button>
        </ContentCard>
      ) : (
        <section className={styles.card}>
          <h2 className={styles.title} style={{ fontSize: '1.1rem' }}>
            Створити спільноту
          </h2>
          {createFormFields}
          <button type="button" className={styles.btnFull} onClick={handleCreate}>
            <Icon name="community" size={18} />
            Створити
          </button>
        </section>
      )}

      {designSystemV2 ? (
        <ContentCard variant="compact">
          <div className={styles.row}>
            <h2 className={styles.title} style={{ fontSize: '1.1rem' }}>
              Мої спільноти
            </h2>
            <Pill tone="accent">{data.mine.length}</Pill>
          </div>
          {data.mine.length === 0 ? (
            <EmptyState
              icon="community"
              title="Ще немає спільнот"
              description="Створи свою або знайди через пошук нижче!"
            />
          ) : (
            <div>
              {data.mine.map((c) => (
                <ListRow
                  key={c.id}
                  leading={<Icon name="community" size={20} />}
                  title={c.name}
                  subtitle={c.description}
                  trailing={<Pill icon={<Icon name="community" size={12} />}>{c.memberIds.length}</Pill>}
                  navigates
                  onClick={() => navigate(`/social/communities/${c.id}`)}
                />
              ))}
            </div>
          )}
        </ContentCard>
      ) : (
        <section className={styles.card}>
          <div className={styles.row}>
            <h2 className={styles.title} style={{ fontSize: '1.1rem' }}>
              Мої спільноти
            </h2>
            <span className={styles.badge}>{data.mine.length}</span>
          </div>
          {data.mine.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🏘️</span>
              <p className={styles.emptyText}>
                Ти ще не впровадив жодної спільноти. Створи свою або знайди через пошук нижче!
              </p>
            </div>
          ) : (
            <ul className={styles.list}>
              {data.mine.map((c) => (
                <li key={c.id} className={styles.communityItem}>
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
      )}

      {designSystemV2 ? (
        <ContentCard variant="compact">
          <h2 className={styles.title} style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
            Пошук публічних спільнот
          </h2>

          <SearchField value={query} onChange={setQuery} placeholder="Введіть назву або опис" />

          {data.results.length === 0 && query.trim() && (
            <EmptyState icon="search" title="Нічого не знайдено" />
          )}

          {data.results.length > 0 && (
            <div>
              {data.results.map((c) => {
                const isMember = data.profile.communities.includes(c.id);
                return (
                  <ListRow
                    key={c.id}
                    leading={<Icon name="community" size={20} />}
                    title={c.name}
                    subtitle={c.description}
                    trailing={
                      isMember ? (
                        <Pill tone="accent" icon={<Icon name="check" size={12} />}>
                          Учасник
                        </Pill>
                      ) : (
                        <Button size="sm" onClick={() => handleJoin(c.id)}>
                          Приєднатись
                        </Button>
                      )
                    }
                    navigates={isMember}
                    onClick={isMember ? () => navigate(`/social/communities/${c.id}`) : undefined}
                  />
                );
              })}
            </div>
          )}
        </ContentCard>
      ) : (
        <section className={styles.card}>
          <h2 className={styles.title} style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
            Пошук публічних спільнот
          </h2>

          <div className={styles.searchField}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Введіть назву або опис"
              className={styles.fieldInput}
              style={{ paddingLeft: '2.4rem' }}
            />
          </div>

          {data.results.length === 0 && query.trim() && (
            <div className={styles.searchEmpty}>
              <p className={styles.muted}>Нічого не знайдено</p>
            </div>
          )}

          {data.results.length > 0 && (
            <ul className={styles.list}>
              {data.results.map((c) => {
                const isMember = data.profile.communities.includes(c.id);
                return (
                  <li key={c.id} className={styles.communityItem}>
                    <div>
                      <Link to={`/social/communities/${c.id}`} className={styles.link}>
                        {c.name}
                      </Link>
                      <p className={styles.muted}>{c.description}</p>
                    </div>
                    {isMember ? (
                      <span className={styles.badge}>✅ Учасник</span>
                    ) : (
                      <button type="button" className={styles.btnJoin} onClick={() => handleJoin(c.id)}>
                        Приєднатись
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </AppPage>
  );
}
