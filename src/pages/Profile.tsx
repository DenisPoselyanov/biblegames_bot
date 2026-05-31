import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { THEMES } from '../data/themes';
import { usePlayer } from '../context/PlayerContext';
import { useTelegram } from '../hooks/useTelegram';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { haptic, WebApp } from '../lib/telegram';
import { DIFFICULTY_LABELS } from '../types';
import { ACHIEVEMENTS } from '../data/achievements';
import { COSMETIC_THEMES, getAvatarById } from '../data/cosmetics';
import { TopicMap } from '../components/TopicMap';
import { loadAllTopicHierarchies } from '../data/topicDbLoader';
import { communityManager } from '../lib/communities';
import { friendChallengeManager } from '../lib/friendChallenges';
import {
  BOLLS_TRANSLATIONS,
  BOLLS_TRANSLATION_LABELS,
  normalizeBollsTranslation,
  type BollsTranslation,
} from '../lib/bollsConstants';
import styles from './Profile.module.css';

function CircularProgress({ value, size = 48, stroke = 4 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`${value}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--gold)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.6s var(--ease-out)' }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="var(--gold)" fontSize={size * 0.28} fontWeight={800} fontFamily="var(--font-sans)">
        {value}%
      </text>
    </svg>
  );
}

export function Profile() {
  const { profile, setActiveTheme, purchaseTheme, setBibleTranslation } = usePlayer();
  const bibleTranslation = normalizeBollsTranslation(profile.bibleTranslation);
  const { displayName, userId } = useTelegram();
  const { showToast } = useToast();
  const [socialVersion, setSocialVersion] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showAllAchievements, setShowAllAchievements] = useState(false);
  const [showId, setShowId] = useState(false);
  const [topicHierarchies, setTopicHierarchies] = useState<Record<string, any>>({});
  const [loadingTopicMap, setLoadingTopicMap] = useState(true);
  const settingsRef = useFocusTrap(settingsOpen);

  // Завантаження ієрархій тем
  useEffect(() => {
    loadAllTopicHierarchies().then((hierarchies) => {
      setTopicHierarchies(hierarchies);
      setLoadingTopicMap(false);
    });
  }, []);

  const themeProgress = THEMES.map((theme) => ({
    theme,
    points: profile.themePoints[theme.id] ?? 0,
    levels: profile.completedLevels.filter((l) => l.themeId === theme.id),
  })).filter((t) => t.points > 0 || t.levels.length > 0);

  const socialProfile = useMemo(
    () => communityManager.getSocialProfile(userId),
    [userId, socialVersion],
  );

  const challengeStats = useMemo(
    () => friendChallengeManager.getUserStats(userId),
    [userId, socialVersion],
  );

  const communitiesCount = useMemo(
    () => communityManager.getUserCommunities(userId).length,
    [userId, socialVersion],
  );

  const unlockedAchievements = ACHIEVEMENTS.filter((a) => profile.achievements.includes(a.id));
  const lockedAchievements = ACHIEVEMENTS.filter((a) => !profile.achievements.includes(a.id));
  const avatarEmoji = profile.avatar ? (getAvatarById(profile.avatar)?.emoji ?? '📖') : '📖';

  const handleSelectTheme = (themeId: string) => {
    haptic.selection();
    setActiveTheme(themeId);
  };

  const handleBuyTheme = (themeId: string) => {
    const result = purchaseTheme(themeId);
    if (!result.purchased) {
      if (result.reason === 'points') {
        showToast('Недостатньо очок для придбання цієї теми!', 'error');
      }
    } else {
      haptic.notification('success');
      showToast('Тему придбано!', 'success');
    }
  };

  const setPrivacy = (key: keyof typeof socialProfile.privacySettings, value: boolean) => {
    communityManager.updateSocialProfile(userId, {
      privacySettings: { ...socialProfile.privacySettings, [key]: value },
    });
    setSocialVersion((v) => v + 1);
  };

  const handleRemoveFriend = (friendId: string) => {
    communityManager.removeFriend(userId, friendId);
    setSocialVersion((v) => v + 1);
  };

  const handleBlock = (blockedUserId: string) => {
    communityManager.blockUser(userId, blockedUserId);
    setSocialVersion((v) => v + 1);
  };

  const handleUnblock = (blockedUserId: string) => {
    communityManager.unblockUser(userId, blockedUserId);
    setSocialVersion((v) => v + 1);
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <button
          className={styles.settingsBtn}
          onClick={() => { haptic.impact('light'); setSettingsOpen(true); }}
          aria-label="Налаштування"
        >
          <Icon name="settings" size={22} />
        </button>
        <div className={styles.avatar}>{avatarEmoji}</div>
        <h1 onClick={() => setShowId((v) => !v)} style={{ cursor: 'pointer' }} title="Тапни щоб показати ID">
          {displayName}
        </h1>
        {showId && <p className={styles.id}>ID: {userId}</p>}
      </header>

      {settingsOpen && (
        <div className={styles.settingsOverlay} onClick={() => setSettingsOpen(false)}>
          <div className={styles.settingsModal} ref={settingsRef} onClick={(e) => e.stopPropagation()}>
            <div className={styles.settingsHeader}>
              <h2>⚙️ Налаштування</h2>
              <button className={styles.settingsClose} onClick={() => setSettingsOpen(false)} aria-label="Закрити">
                <Icon name="close" size={18} />
              </button>
            </div>
            <Link to="/admin" className={styles.settingsAdminBtn} onClick={() => { haptic.impact('light'); setSettingsOpen(false); }}>
              <Icon name="admin" size={16} /> Адмін-панель
            </Link>
            <div className={styles.settingsSection}>
              <h3 className={styles.settingsSubtitle}>Переклад Писання</h3>
              <p className={styles.settingsHint}>Текст уривків з bolls.life у поясненнях та на головній</p>
              <div className={styles.translationPicker}>
                {BOLLS_TRANSLATIONS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`${styles.translationOption} ${bibleTranslation === id ? styles.translationOptionActive : ''}`}
                    onClick={() => {
                      haptic.selection();
                      setBibleTranslation(id as BollsTranslation);
                    }}
                  >
                    <strong>{id}</strong>
                    <span>{BOLLS_TRANSLATION_LABELS[id]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.toggleRow}>
              <label><input type="checkbox" checked={socialProfile.privacySettings.showProfile} onChange={(e) => setPrivacy('showProfile', e.target.checked)} /> Показувати профіль</label>
            </div>
            <div className={styles.toggleRow}>
              <label><input type="checkbox" checked={socialProfile.privacySettings.showStats} onChange={(e) => setPrivacy('showStats', e.target.checked)} /> Показувати статистику</label>
            </div>
            <div className={styles.toggleRow}>
              <label><input type="checkbox" checked={socialProfile.privacySettings.allowChallenges} onChange={(e) => setPrivacy('allowChallenges', e.target.checked)} /> Дозволити виклики</label>
            </div>
            <div className={styles.toggleRow}>
              <label><input type="checkbox" checked={socialProfile.privacySettings.showInLeaderboards} onChange={(e) => setPrivacy('showInLeaderboards', e.target.checked)} /> У лідербордах</label>
            </div>
            {socialProfile.blockedUsers.length > 0 && (
              <>
                <h3 className={styles.blockedTitle}>🚫 Заблоковані</h3>
                <ul className={styles.blockedList}>
                  {socialProfile.blockedUsers.map((id) => (
                    <li key={id} className={styles.blockedItem}>
                      <span>{id}</span>
                      <button type="button" className={styles.socialMiniBtn} onClick={() => handleUnblock(id)}>Розблок</button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      <section className={styles.statsGrid}>
        <article className={styles.statsCard}>
          <span className={styles.statsLabel}>Очки</span>
          <strong className={styles.statsValue}>{profile.totalPoints}</strong>
        </article>
        <article className={styles.statsCard}>
          <span className={styles.statsLabel}>Монети</span>
          <strong className={styles.statsValue}>{profile.coins}</strong>
        </article>
        <article className={styles.statsCard}>
          <span className={styles.statsLabel}>Мільйонер</span>
          <strong className={styles.statsValue}>{profile.millionaireWins}</strong>
        </article>
      </section>

      <Link to="/stats" className={styles.ratingBtn}>
        <Icon name="stats" size={18} /> Загальний Рейтинг
      </Link>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>🤝 Соціальне</h2>
        <div className={styles.socialRow}>
          <Link to="/social/challenges" className={styles.socialBtn}>
            <Icon name="challenge" size={22} />
            <span>Виклики друзів</span>
          </Link>
          <Link to="/social/communities" className={styles.socialBtn}>
            <Icon name="community" size={22} />
            <span>Спільноти</span>
          </Link>
        </div>
        <div className={styles.socialQuickStats}>
          <div><span>Друзі</span><strong>{socialProfile.friends.length}</strong></div>
          <div><span>Спільноти</span><strong>{communitiesCount}</strong></div>
          <div>
            <span>Winrate</span>
            <CircularProgress value={challengeStats.winRate} size={40} stroke={3} />
          </div>
        </div>
        <button className={styles.inviteBtn} onClick={() => {
          const shareUrl = `https://t.me/share/url?url=${encodeURIComponent('https://t.me/biblegames_bot')}&text=${encodeURIComponent('Приєднуйся до біблійної гри! Мій ID: ' + userId)}`;
          try { WebApp?.openTelegramLink?.(shareUrl); } catch { navigator.clipboard.writeText(userId).then(() => showToast('ID скопійовано: ' + userId, 'success')); }
        }}>
          <Icon name="challenge" size={18} /> Запросити друга
        </button>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>🏆 Кабінет досягнень</h2>
          <button className={styles.seeAllBtn} onClick={() => setShowAllAchievements(true)}>Усі</button>
        </div>
        {unlockedAchievements.length === 0 ? (
          <p className={styles.empty}>Ще немає досягнень</p>
        ) : (
          <div className={styles.achCarousel}>
            {unlockedAchievements.map((ach) => (
              <div key={ach.id} className={styles.achBadge} title={ach.description}>
                <span className={styles.achBadgeIcon}>{ach.icon}</span>
                <span className={styles.achBadgeLabel}>{ach.title}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {showAllAchievements && (
        <div className={styles.settingsOverlay} onClick={() => setShowAllAchievements(false)}>
          <div className={styles.achModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.settingsHeader}>
              <h2>🏆 Мої нагороди</h2>
              <button className={styles.settingsClose} onClick={() => setShowAllAchievements(false)} aria-label="Закрити"><Icon name="close" size={18} /></button>
            </div>
            <div className={styles.achModalList}>
              <h3>Відкрито ({unlockedAchievements.length})</h3>
              {unlockedAchievements.map((ach) => (
                <div key={ach.id} className={`${styles.achievementItem} ${styles.achUnlocked}`}>
                  <span className={styles.achIcon}>{ach.icon}</span>
                  <div className={styles.achMeta}><h3>{ach.title}</h3><p>{ach.description}</p></div>
                </div>
              ))}
              {lockedAchievements.length > 0 && (
                <>
                  <h3 style={{ marginTop: '1rem', opacity: 0.6 }}>Закрито ({lockedAchievements.length})</h3>
                  {lockedAchievements.map((ach) => (
                    <div key={ach.id} className={`${styles.achievementItem} ${styles.achLocked}`}>
                      <span className={styles.achIcon}>{ach.icon}</span>
                      <div className={styles.achMeta}><h3>{ach.title}</h3><p>{ach.description}</p></div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>🎨 Магазин біблійних тем</h2>
        <p className={styles.sectionSubtitle}>Змінюй оформлення гри</p>
        <div className={styles.shopCarousel}>
          {COSMETIC_THEMES.map((theme) => {
            const isUnlocked = profile.unlockedThemes.includes(theme.id) || theme.price === 0;
            const isActive = profile.activeTheme === theme.id;
            return (
              <div key={theme.id} className={`${styles.shopCard} ${isActive ? styles.shopCardActive : ''}`}>
                <div className={styles.shopPreview} style={{ background: theme.preview.background }}>
                  <div className={styles.shopPreviewSurface} style={{ background: theme.preview.surface }}>
                    <span style={{ color: theme.preview.text }}>Aa</span>
                    <span className={styles.shopAccent} style={{ background: theme.preview.accent }} />
                  </div>
                  <span className={styles.shopPrimary} style={{ background: theme.preview.primary }} />
                </div>
                <h3>{theme.title}</h3>
                <p>{theme.description}</p>
                {isActive ? (
                  <span className={styles.badgeActive}>Активна</span>
                ) : isUnlocked ? (
                  <button type="button" className={styles.shopApplyBtn} onClick={() => handleSelectTheme(theme.id)}>Застосувати</button>
                ) : (
                  <button type="button" className={styles.shopBuyBtn} onClick={() => handleBuyTheme(theme.id)}>Придбати ({theme.price})</button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>📈 Рівень знань (Mastery)</h2>
        {!loadingTopicMap && (
          <TopicMap
            topicHierarchy={topicHierarchies}
            masteryStates={profile.studyMastery}
            maxHeight="400px"
            showQuestionCount={false}
            onNodeClick={(node) => {
              if (node.themeId) {
                haptic.impact('light');
                // Навігація до деталізації теми
                // Можливо додати логіку переходу до ThemeDetail
              }
            }}
          />
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>🗺️ Прогрес за темами</h2>
        {themeProgress.length === 0 ? (
          <p className={styles.empty}>Ще немає очок. Обери тематику та пройди перший рівень!</p>
        ) : (
          <ul className={styles.themeList}>
            {themeProgress.map(({ theme, points, levels }) => (
              <li key={theme.id} className={styles.themeItem}>
                <span className={styles.themeIcon}>{theme.icon}</span>
                <div className={styles.themeInfo}>
                  <strong>{theme.title}</strong>
                  <small>{points} очок · {levels.length} рівн.{levels.length > 0 && ` (${levels.map((l) => DIFFICULTY_LABELS[l.difficulty] ?? l.difficulty).join(', ')})`}</small>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
