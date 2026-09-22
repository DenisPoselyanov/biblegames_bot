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
  CoverArt,
  Dialog,
  ListRow,
  MetricTile,
  MetricTileGrid,
  PageHeader,
  ProgressRing,
  SectionHeader,
  SegmentedControl,
  ThemeSwatch,
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
import { computeWisdomProgress, formatRankLabel } from '../../lib/practiceProgression';
import { isFeatureEnabled } from '../../lib/flags';
import styles from './ProfileV2.module.css';

const AURORA_DARK_THEME_ID = 'aurora';
const AURORA_LIGHT_THEME_ID = 'aurora-light';

export function ProfileV2() {
  const navigate = useNavigate();
  const profile = useResolvedProfile();
  const { activeTheme, setActiveTheme } = usePreferences();
  const { displayName, userId } = useTelegram();
  const { showToast } = useToast();
  const [showAllAchievements, setShowAllAchievements] = useState(false);
  const designSystemV2 = isFeatureEnabled('designSystemV2');
  const appearanceMode = activeTheme === AURORA_LIGHT_THEME_ID ? 'light' : 'dark';

  const socialProfile = useMemo(() => communityManager.getSocialProfile(userId), [userId]);
  const challengeStats = useMemo(() => friendChallengeManager.getUserStats(userId), [userId]);
  const communitiesCount = useMemo(
    () => communityManager.getUserCommunities(userId).length,
    [userId],
  );

  const unlockedAchievements = ACHIEVEMENTS.filter((a) => profile.achievements.includes(a.id));
  const lockedAchievements = ACHIEVEMENTS.filter((a) => !profile.achievements.includes(a.id));
  const avatarEmoji = profile.avatar ? (getAvatarById(profile.avatar)?.emoji ?? '📖') : '📖';
  const activeThemeData = getCosmeticThemeById(activeTheme);
  const activeThemeTitle = activeThemeData?.title ?? activeTheme;
  const rankProgress = computeWisdomProgress(profile.playerRank);
  const rankProgressPct =
    rankProgress.required > 0
      ? Math.min(100, Math.round((rankProgress.current / rankProgress.required) * 100))
      : 100;

  const handleAppearanceModeChange = (mode: 'dark' | 'light') => {
    haptic.selection();
    const themeId = mode === 'light' ? AURORA_LIGHT_THEME_ID : AURORA_DARK_THEME_ID;
    if (!setActiveTheme(themeId)) {
      showToast('Не вдалося застосувати тему', 'error');
    }
  };

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
      {designSystemV2 ? (
        <div className={styles.hero}>
          <CoverArt seed={userId} glyph="wave" className={styles.heroCover} />
          <button
            type="button"
            className={styles.heroSettingsBtn}
            onClick={() => navigate('/profile/settings')}
            aria-label="Налаштування"
          >
            <Icon name="settings" size={18} />
          </button>
          <div className={styles.heroBody}>
            <div className={styles.heroAvatarWrap}>
              <ProgressRing
                value={rankProgressPct}
                size={72}
                strokeWidth={5}
                centerLabel={<span className={styles.heroAvatarEmoji}>{avatarEmoji}</span>}
                label="Прогрес рангу"
              />
            </div>
            <div className={styles.heroInfo}>
              <p className={styles.heroName}>{displayName}</p>
              <p className={styles.heroRank}>{formatRankLabel(profile.playerRank.tier, profile.playerRank.plaque)}</p>
            </div>
          </div>
        </div>
      ) : (
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
      )}

      <PlayerRankCard playerRank={profile.playerRank} />

      {designSystemV2 && (
        <section>
          <SectionHeader title="Вигляд" />
          <SegmentedControl
            label="Режим оформлення"
            value={appearanceMode}
            onChange={handleAppearanceModeChange}
            options={[
              { value: 'dark', label: '🌙 Темний' },
              { value: 'light', label: '☀️ Світлий' },
            ]}
          />
        </section>
      )}

      <div className={styles.card}>
        <ListRow
          leading={<Icon name="settings" size={20} />}
          title="Налаштування"
          navigates
          onClick={() => navigate('/profile/settings')}
        />
        <ListRow
          leading={
            designSystemV2 && activeThemeData ? (
              <ThemeSwatch theme={activeThemeData} />
            ) : (
              <Icon name="star" size={20} />
            )
          }
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
