/**
 * Settings screen (Phase 3 WS8, spec §14.2/§14.3). Groups with real plumbing
 * (translation, theme, motion intensity, privacy) are functional; groups with
 * no backend at all (locale, notifications, text size/a11y, data export/
 * delete, logout — Telegram auth has no classic session to end) render as
 * visible, clearly-labeled "Скоро" rows rather than being fabricated or
 * hidden, per the spec's "where supported"/"where implemented" allowance.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppPage, ListRow, PageHeader, SectionHeader, SegmentedControl, ThemeSwatch } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useAuthSession } from '../../context/AuthSessionContext';
import { useResolvedProfile } from '../../hooks/domain/useProfileWriter';
import { usePreferences } from '../../hooks/usePreferences';
import { useMotionCapabilities } from '../../components/motion/MotionProvider';
import { hasApi } from '../../repos/apiClient';
import { progressionRepo } from '../../repos/progressionRepo';
import { hasStoredMotionIntensity } from '../../lib/motionIntensity';
import { getCosmeticThemeById } from '../../data/cosmetics';
import { communityManager } from '../../lib/communities';
import { haptic } from '../../lib/telegram';
import { isFeatureEnabled } from '../../lib/flags';
import {
  BOLLS_TRANSLATIONS,
  normalizeBollsTranslation,
  type BollsTranslation,
} from '../../lib/bollsConstants';
import styles from './Settings.module.css';

function UnavailableRow({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <ListRow
      title={title}
      subtitle={subtitle}
      trailing={<span className={styles.badge}>Скоро</span>}
    />
  );
}

let timezoneSyncAttempted = false;

const TRANSLATION_OPTIONS = BOLLS_TRANSLATIONS.map((id) => ({ value: id, label: id })) as [
  { value: BollsTranslation; label: string },
  { value: BollsTranslation; label: string },
  { value: BollsTranslation; label: string },
];

export function Settings() {
  const navigate = useNavigate();
  const { userId } = useAuthSession();
  const profile = useResolvedProfile();
  const { activeTheme, setBibleTranslation } = usePreferences();
  const bibleTranslation = normalizeBollsTranslation(profile.bibleTranslation);
  const { intensity, setIntensity } = useMotionCapabilities();
  const [socialVersion, setSocialVersion] = useState(0);

  const socialProfile = useMemo(
    () => communityManager.getSocialProfile(userId),
    [userId, socialVersion],
  );

  const setPrivacy = (key: keyof typeof socialProfile.privacySettings, value: boolean) => {
    communityManager.updateSocialProfile(userId, {
      privacySettings: { ...socialProfile.privacySettings, [key]: value },
    });
    setSocialVersion((v) => v + 1);
  };

  const handleUnblock = (blockedUserId: string) => {
    communityManager.unblockUser(userId, blockedUserId);
    setSocialVersion((v) => v + 1);
  };

  // Cross-device hydration: only when this device has never set an
  // intensity explicitly, adopt the server's last-known value once. Never
  // runs again after that (whichever value wins becomes the local choice).
  useEffect(() => {
    if (hasStoredMotionIntensity()) return;
    if (profile.motionIntensity && profile.motionIntensity !== intensity) {
      setIntensity(profile.motionIntensity);
    }
  }, [profile.motionIntensity, intensity, setIntensity]);

  // Auto-detect + sync once — no manual picker in this pass (§14.2 "Часовий
  // пояс"), never overrides a value the server already has.
  useEffect(() => {
    if (timezoneSyncAttempted || !hasApi()) return;
    timezoneSyncAttempted = true;
    if (profile.timezone) return;
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) progressionRepo.savePreferences({ timezone: detected }).catch(() => {});
    } catch {
      /* Intl unsupported — leave unset */
    }
  }, [profile.timezone]);

  const timezoneLabel =
    profile.timezone ??
    (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        return 'Не визначено';
      }
    })();

  const designSystemV2 = isFeatureEnabled('designSystemV2');
  const activeThemeData = getCosmeticThemeById(activeTheme);
  const activeThemeTitle = activeThemeData?.title ?? activeTheme;

  return (
    <AppPage className={styles.page}>
      <PageHeader title="Налаштування" onBack={() => navigate('/profile')} />

      <section>
        <SectionHeader title="Акаунт" />
        <div className={styles.card}>
          <ListRow leading={<Icon name="profile" size={20} />} title="Ім'я" subtitle={profile.displayName} />
          <Link to="/admin" className={styles.plainLink} onClick={() => haptic.impact('light')}>
            <ListRow leading={<Icon name="admin" size={20} />} title="Адмін-панель" navigates />
          </Link>
        </div>
      </section>

      <section>
        <SectionHeader title="Переклад і мова" />
        <div className={styles.card}>
          <ListRow
            leading={<Icon name="book" size={20} />}
            title="Переклад Писання"
            subtitle="bolls.life — тексти уривків"
            trailing={
              <SegmentedControl
                label="Переклад Писання"
                value={bibleTranslation}
                onChange={(v: BollsTranslation) => {
                  haptic.selection();
                  setBibleTranslation(v);
                }}
                options={TRANSLATION_OPTIONS}
              />
            }
          />
          <UnavailableRow title="Мова інтерфейсу" subtitle="Українська" />
          <ListRow leading={<Icon name="clock" size={20} />} title="Часовий пояс" subtitle={timezoneLabel} />
        </div>
      </section>

      <section>
        <SectionHeader title="Вигляд і рух" />
        <div className={styles.card}>
          <ListRow
            leading={
              designSystemV2 && activeThemeData ? (
                <ThemeSwatch theme={activeThemeData} />
              ) : (
                <Icon name="star" size={20} />
              )
            }
            title="Тема оформлення"
            subtitle={activeThemeTitle}
            navigates
            onClick={() => navigate('/profile/themes')}
          />
          <ListRow
            leading={<Icon name="refresh" size={20} />}
            title="Інтенсивність анімацій"
            subtitle="Хаптика й ефекти слідують цій настройці"
            trailing={
              <SegmentedControl
                label="Інтенсивність анімацій"
                value={intensity}
                onChange={(v) => {
                  haptic.selection();
                  setIntensity(v);
                }}
                options={[
                  { value: 'full', label: 'Повна' },
                  { value: 'reduced', label: 'Менше' },
                  { value: 'minimal', label: 'Мін.' },
                ]}
              />
            }
          />
          <UnavailableRow title="Розмір тексту" subtitle="Спеціальні налаштування доступності" />
        </div>
      </section>

      <UnavailableRow title="Сповіщення" subtitle="Ще не підтримується" />

      <section>
        <SectionHeader title="Приватність" />
        <div className={styles.card}>
          <PrivacyToggle
            label="Показувати профіль"
            checked={socialProfile.privacySettings.showProfile}
            onChange={(v) => setPrivacy('showProfile', v)}
          />
          <PrivacyToggle
            label="Показувати статистику"
            checked={socialProfile.privacySettings.showStats}
            onChange={(v) => setPrivacy('showStats', v)}
          />
          <PrivacyToggle
            label="Дозволити виклики"
            checked={socialProfile.privacySettings.allowChallenges}
            onChange={(v) => setPrivacy('allowChallenges', v)}
          />
          <PrivacyToggle
            label="У лідербордах"
            checked={socialProfile.privacySettings.showInLeaderboards}
            onChange={(v) => setPrivacy('showInLeaderboards', v)}
          />
        </div>
        {socialProfile.blockedUsers.length > 0 && (
          <div className={styles.blockedList}>
            <p className={styles.blockedTitle}>Заблоковані</p>
            {socialProfile.blockedUsers.map((id) => (
              <div key={id} className={styles.blockedItem}>
                <span>{id}</span>
                <button type="button" className={styles.unblockBtn} onClick={() => handleUnblock(id)}>
                  Розблок
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Дані та сеанс" />
        <div className={styles.card}>
          <UnavailableRow title="Експорт / видалення даних" subtitle="Ще не підтримується" />
          <UnavailableRow title="Вихід із сеансу" subtitle="Telegram керує входом у застосунок" />
        </div>
      </section>
    </AppPage>
  );
}

function PrivacyToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}): ReactNode {
  return (
    <ListRow
      title={label}
      trailing={
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={checked}
          aria-label={label}
          onChange={(e) => onChange(e.target.checked)}
        />
      }
    />
  );
}
