import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTelegram } from '../../hooks/useTelegram';
import { communityManager } from '../../lib/communities';
import { AppPage, ErrorState, PageHeader } from '../../components/ui';
import styles from './Social.module.css';

export function CommunityDetails() {
  const navigate = useNavigate();
  const { communityId } = useParams<{ communityId: string }>();
  const { userId } = useTelegram();
  const [version, setVersion] = useState(0);

  const community = useMemo(
    () => (communityId ? communityManager.getCommunity(communityId) : undefined),
    [communityId, version],
  );

  const profile = useMemo(() => communityManager.getSocialProfile(userId), [userId, version]);

  if (!community) {
    return (
      <AppPage>
        <PageHeader onBack={() => navigate('/social/communities')} title="Спільнота" />
        <ErrorState title="Спільноту не знайдено" />
      </AppPage>
    );
  }

  const isCreator = community.creatorId === userId;
  const isMember = profile.communities.includes(community.id);

  const handleJoin = () => {
    communityManager.joinCommunity(community.id, userId);
    setVersion((v) => v + 1);
  };

  const handleLeave = () => {
    communityManager.leaveCommunity(community.id, userId);
    navigate('/social/communities');
  };

  const handleDelete = () => {
    const ok = window.confirm('Видалити спільноту?');
    if (!ok) return;
    communityManager.deleteCommunity(community.id, userId);
    navigate('/social/communities');
  };

  const handleRemoveMember = (memberId: string) => {
    communityManager.removeMember(community.id, memberId, userId);
    setVersion((v) => v + 1);
  };

  return (
    <AppPage>
      <PageHeader
        onBack={() => navigate('/social/communities')}
        title={community.name}
        action={
          community.isPublic ? (
            <span className={styles.badge}>PUBLIC</span>
          ) : (
            <span className={styles.badge}>PRIVATE</span>
          )
        }
      />

      <section className={styles.card}>
        <p className={styles.muted}>{community.description}</p>
        <p className={styles.muted}>Учасників: {community.memberIds.length}</p>

        {isCreator ? (
          <button type="button" className={styles.btnSecondary} onClick={handleDelete}>
            Видалити спільноту
          </button>
        ) : isMember ? (
          <button type="button" className={styles.btnSecondary} onClick={handleLeave}>
            Покинути
          </button>
        ) : community.isPublic ? (
          <button type="button" className={styles.btnPrimary} onClick={handleJoin}>
            Приєднатись
          </button>
        ) : (
          <p className={styles.muted}>Це приватна спільнота</p>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.title} style={{ fontSize: '1.1rem' }}>
          Учасники
        </h2>
        <ul className={styles.list}>
          {community.memberIds.map((id) => (
            <li key={id} className={styles.row}>
              <span>{id}{id === community.creatorId ? ' (creator)' : ''}</span>
              {isCreator && id !== community.creatorId && (
                <button type="button" className={styles.miniBtn} onClick={() => handleRemoveMember(id)}>
                  Видалити
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </AppPage>
  );
}

