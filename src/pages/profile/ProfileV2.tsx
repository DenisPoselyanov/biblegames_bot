/**
 * Profile screen v2 (Phase 3 WS8, spec §14.1), behind `profileSettingsV2`.
 * Full reskin of the legacy `Profile.tsx` header onto the WS3 UI kit, with
 * navigation into the new Settings/Themes screens. The rank/coins/wins
 * summary and achievements carousel are ported as-is (still Profile-specific
 * content, nothing else shows them); the mastery map and per-theme progress
 * list are deliberately NOT duplicated here — WS7's `/progress` screen and
 * the Learn hub already own that data, so this links out to them instead of
 * building a second, competing view of the same state.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AchievementBadge,
  AppPage,
  Dialog,
  ListRow,
  MetricTile,
  MetricTileGrid,
  PageHeader,
  SectionHeader,
} from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useResolvedProfile } from '../../hooks/domain/useProfileWriter';
import { usePreferences } from '../../hooks/usePreferences';
import { useTelegram } from '../../hooks/useTelegram';
import { haptic, WebApp } from '../../lib/telegram';
import { useToast } from '../../components/Toast';
import { ACHIEVEMENTS } from '../../data/achievements';
import { getAvatarById, getCosmeticThemeById } from '../../data/cosmetics';
import { communityManager } from '../../lib/communities';
import { friendChallengeManager } from '../../lib/friendChallenges';
import { PlayerRankCard } from '../../components/PlayerRankCard';
import styles from './ProfileV2.module.css';

export function ProfileV2() {
  const navigate = useNavigate();
  const profile = useResolvedProfile();
  const { activeTheme } = usePreferences();
  const { displayName, userId } = useTelegram();
  const { showToast } = useToast();
  const [showAllAchievements, setShowAllAchievements] = useState(false);

  const socialProfile = useMemo(() => communityManager.getSocialProfile(userId), [userId]);
  const challengeStats = useMemo(() => friendChallengeManager.getUserStats(userId), [userId]);
  const communitiesCount = useMemo(
    () => communityManager.getUserCommunities(userId).length,
    [userId],
  );

  const unlockedAchievements = ACHIEVEMENTS.filter((a) => profile.achievements.includes(a.id));
  const lockedAchievements = ACHIEVEMENTS.filter((a) => !profile.achievements.includes(a.id));
  const avatarEmoji = profile.avatar ? (getAvatarById(profile.avatar)?.emoji ?? '📖') : '📖';
  const activeThemeTitle = getCosmeticThemeById(activeTheme)?.title ?? activeTheme;

  const handleInvite = () => {
    haptic.impact('light');
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent('https://t.me/biblegames_bot')}&text=${encodeURIComponent('Приєднуйся до біблійної гри! Мій ID: ' + userId)}`;
    try {
      WebApp?.openTelegramLink?.(shareUrl);
    } catch {
      navigator.clipboard.writeText(userId).then(() => showToast('ID скопійовано: ' + userId, 'success'));
    }
  };

  return (
    <AppPage className={styles.page}>
      <PageHeader
        kicker="Профіль"
        title={displayName}
        description={`Обліковий запис активний · ID ${userId}`}
        action={
          <button
            type="button"
            className={styles.avatarBtn}
            onClick={() => navigate('/profile/settings')}
            aria-label="Налаштування"
          >
            {avatarEmoji}
          </button>
        }
      />

      <PlayerRankCard playerRank={profile.playerRank} />

      <div className={styles.card}>
        <ListRow
          leading={<Icon name="settings" size={20} />}
          title="Налаштування"
          navigates
          onClick={() => navigate('/profile/settings')}
        />
        <ListRow
          leading={<Icon name="star" size={20} />}
          title="Оформлення"
          subtitle={activeThemeTitle}
          navigates
          onClick={() => navigate('/profile/themes')}
        />
        <ListRow
          leading={<Icon name="community" size={20} />}
          title="Спільноти"
          subtitle={`${communitiesCount} приєднано`}
          navigates
          onClick={() => navigate('/social/communities')}
        />
        <ListRow
          leading={<Icon name="shop" size={20} />}
          title="Крамниця"
          subtitle="Теми та аватари"
          navigates
          onClick={() => {
            haptic.impact('light');
            navigate('/shop');
          }}
        />
        <ListRow
          leading={<Icon name="brain" size={20} />}
          title="Прогрес навчання"
          navigates
          onClick={() => navigate('/progress')}
        />
      </div>

      <MetricTileGrid>
        <MetricTile icon={<Icon name="coins" size={20} />} value={profile.coins} label="монет" />
        <MetricTile
          icon={<Icon name="millionaire" size={20} />}
          value={profile.millionaireWins}
          label="перемог у Мільйонері"
        />
        <MetricTile
          icon={<Icon name="survival" size={20} />}
          value={profile.survivalHighScore}
          label="рекорд Виживання"
        />
      </MetricTileGrid>

      <section>
        <SectionHeader title="Соціальне" />
        <div className={styles.socialQuickStats}>
          <div>
            <span>Друзі</span>
            <strong>{socialProfile.friends.length}</strong>
          </div>
          <div>
            <span>Перемоги</span>
            <strong>{challengeStats.winRate}%</strong>
          </div>
        </div>
        <button type="button" className={styles.inviteBtn} onClick={handleInvite}>
          <Icon name="challenge" size={18} /> Запросити друга
        </button>
      </section>

      <section>
        <SectionHeader
          title="Кабінет досягнень"
          actionLabel="Усі"
          onAction={() => setShowAllAchievements(true)}
        />
        {unlockedAchievements.length === 0 ? (
          <p className={styles.empty}>Ще немає досягнень</p>
        ) : (
          <div className={styles.achievements}>
            {unlockedAchievements.map((a) => (
              <AchievementBadge key={a.id} icon={a.icon} label={a.title} />
            ))}
          </div>
        )}
      </section>

      <Dialog
        open={showAllAchievements}
        onClose={() => setShowAllAchievements(false)}
        title="Мої нагороди"
      >
        <div className={styles.achModalList}>
          <p className={styles.sectionLabel}>Відкрито ({unlockedAchievements.length})</p>
          <div className={styles.achievements}>
            {unlockedAchievements.map((a) => (
              <AchievementBadge key={a.id} icon={a.icon} label={a.title} />
            ))}
          </div>
          {lockedAchievements.length > 0 && (
            <>
              <p className={styles.sectionLabel}>Закрито ({lockedAchievements.length})</p>
              <div className={styles.achievements}>
                {lockedAchievements.map((a) => (
                  <AchievementBadge key={a.id} icon={a.icon} label={a.title} locked />
                ))}
              </div>
            </>
          )}
        </div>
      </Dialog>
    </AppPage>
  );
}
