import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTelegram } from '../../hooks/useTelegram';
import { friendChallengeManager } from '../../lib/friendChallenges';
import { isFeatureEnabled } from '../../lib/flags';
import { AppPage, Button, ContentCard, ErrorState, PageHeader, Pill } from '../../components/ui';
import styles from './Social.module.css';

export function ChallengeDetails() {
  const navigate = useNavigate();
  const { challengeId } = useParams<{ challengeId: string }>();
  const { userId } = useTelegram();
  const [score, setScore] = useState('');
  const [version, setVersion] = useState(0);
  const designSystemV2 = isFeatureEnabled('designSystemV2');

  const challenge = useMemo(
    () => (challengeId ? friendChallengeManager.getChallenge(challengeId) : undefined),
    [challengeId, version],
  );

  if (!challenge) {
    return (
      <AppPage>
        <PageHeader onBack={() => navigate('/social/challenges')} title="Виклик" />
        <ErrorState title="Виклик не знайдено" />
      </AppPage>
    );
  }

  const isChallenger = challenge.challengerId === userId;
  const isChallenged = challenge.challengedId === userId;

  const handleAccept = () => {
    friendChallengeManager.acceptChallenge(challenge.id);
    setVersion((v) => v + 1);
  };

  const handleDecline = () => {
    friendChallengeManager.declineChallenge(challenge.id);
    navigate('/social/challenges');
  };

  const handleComplete = () => {
    const value = Number(score);
    if (!Number.isFinite(value) || value < 0) return;
    friendChallengeManager.completeChallenge(challenge.id, value);
    navigate('/social/challenges');
  };

  const handleDelete = () => {
    friendChallengeManager.deleteChallenge(challenge.id, userId);
    navigate('/social/challenges');
  };

  const details = (
    <>
      <p className={styles.muted}>
        Створено: {new Date(challenge.createdAt).toLocaleString()} · Діє до: {new Date(challenge.expiresAt).toLocaleString()}
      </p>
      <p className={styles.muted}>
        Рахунок: {challenge.challengerScore}:{challenge.challengedScore ?? '—'}
      </p>
    </>
  );

  return (
    <AppPage>
      <PageHeader
        onBack={() => navigate('/social/challenges')}
        title={`${challenge.challengerName} vs ${challenge.challengedName}`}
        action={
          designSystemV2 ? (
            <Pill tone="accent">{challenge.status.toUpperCase()}</Pill>
          ) : (
            <span className={styles.badge}>{challenge.status.toUpperCase()}</span>
          )
        }
      />

      {designSystemV2 ? (
        <ContentCard variant="compact">
          {details}

          {challenge.status === 'pending' && isChallenged && (
            <div className={styles.row}>
              <Button onClick={handleAccept}>Прийняти</Button>
              <Button variant="secondary" onClick={handleDecline}>
                Відхилити
              </Button>
            </div>
          )}

          {challenge.status === 'pending' && isChallenger && (
            <Button variant="secondary" onClick={handleDelete}>
              Скасувати виклик
            </Button>
          )}

          {challenge.status === 'accepted' && isChallenged && (
            <>
              <label className={styles.field}>
                <span>Твій результат</span>
                <input
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="Наприклад: 1200"
                  inputMode="numeric"
                  className={styles.fieldInput}
                />
              </label>
              <Button onClick={handleComplete}>Завершити</Button>
            </>
          )}
        </ContentCard>
      ) : (
        <section className={styles.card}>
          {details}

          {challenge.status === 'pending' && isChallenged && (
            <div className={styles.row}>
              <button type="button" className={styles.btnPrimary} onClick={handleAccept}>
                Прийняти
              </button>
              <button type="button" className={styles.btnSecondary} onClick={handleDecline}>
                Відхилити
              </button>
            </div>
          )}

          {challenge.status === 'pending' && isChallenger && (
            <button type="button" className={styles.btnSecondary} onClick={handleDelete}>
              Скасувати виклик
            </button>
          )}

          {challenge.status === 'accepted' && isChallenged && (
            <>
              <label className={styles.field}>
                <span>Твій результат</span>
                <input
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="Наприклад: 1200"
                  inputMode="numeric"
                />
              </label>
              <button type="button" className={styles.btnPrimary} onClick={handleComplete}>
                Завершити
              </button>
            </>
          )}
        </section>
      )}

      {!isChallenger && !isChallenged && (
        <p className={styles.muted}>Цей виклик не належить твоєму профілю</p>
      )}
    </AppPage>
  );
}

