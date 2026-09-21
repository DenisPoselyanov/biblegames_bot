/**
 * Progress screen (Phase 3 WS7, spec §13): completion, mastery, review
 * health, streak and motivational rank shown as distinct sections rather
 * than four vanity numbers (§13 "avoid ..."). Rank/streak/mastery/
 * achievements come from `useResolvedProfile()` — the same server-backed
 * (ADR-016 `progression_state`/`achievement_grants`) store the legacy
 * dashboard already reads, not a new client computation. Review health is
 * the new WS7 `GET /learning/review/due`. Objective/module-level progress
 * has no per-user aggregation endpoint yet (same gap `PlanDetail`/
 * `ModuleDetail` flagged in WS6) — not fabricated here either, the section
 * links into Learn instead of showing a fake bar.
 */
import { useNavigate } from 'react-router-dom';
import { useAuthSession } from '../../context/AuthSessionContext';
import { useResolvedProfile } from '../../hooks/domain/useProfileWriter';
import { useReviewDue, useTodayView } from '../../queries/useLearning';
import { computeWisdomProgress, formatRankLabel } from '../../lib/practiceProgression';
import { ACHIEVEMENTS } from '../../data/achievements';
import { isFeatureEnabled } from '../../lib/flags';
import {
  AchievementBadge,
  AnimatedNumber,
  AppPage,
  Button,
  ContentCard,
  CoverArt,
  HeroCard,
  MetricTile,
  MetricTileGrid,
  PageHeader,
  ProgressRing,
} from '../../components/ui';
import { Icon } from '../../components/Icon';
import styles from './ProgressV2.module.css';

export function ProgressV2() {
  const navigate = useNavigate();
  const { userId } = useAuthSession();
  const profile = useResolvedProfile();
  const reviewDue = useReviewDue(userId);
  const today = useTodayView(userId);
  const designSystemV2 = isFeatureEnabled('designSystemV2');

  const wisdom = computeWisdomProgress(profile.playerRank);
  const rankLabel = formatRankLabel(profile.playerRank.tier, profile.playerRank.plaque);
  const wisdomPct = wisdom.required > 0 ? Math.min(100, (wisdom.current / wisdom.required) * 100) : 100;
  const masteredCount = Object.keys(profile.studyMastery ?? {}).length;
  const activeLesson = today.data?.activeLesson;

  return (
    <AppPage className={styles.page}>
      <PageHeader kicker="Прогрес" title="Твій шлях" />

      {/* §13.5: level/rank summary — server-authoritative playerRank.
          Phase 3.5 §6 WS5: `tone="cover"` reuses WS3's hero-card pattern
          (§4 "screen's main object" rule) instead of the flat surface card;
          same data, no new fields. */}
      {designSystemV2 ? (
        <HeroCard
          tone="cover"
          coverSeed={profile.playerRank.tier}
          coverGlyph="rays"
          kicker={rankLabel}
          title={`${profile.streakDays} дн. поспіль`}
          footer={
            <div className={styles.rankFooterOnColor}>
              <ProgressRing onColor value={wisdomPct} centerLabel={<AnimatedNumber value={wisdom.current} />} />
              <p className={styles.wisdomLabelOnColor}>
                {wisdom.label}: {wisdom.current}/{wisdom.required}
              </p>
            </div>
          }
        />
      ) : (
        <HeroCard
          kicker={rankLabel}
          title={`${profile.streakDays} дн. поспіль`}
          footer={
            <div className={styles.rankFooter}>
              <ProgressRing value={wisdomPct} centerLabel={<AnimatedNumber value={wisdom.current} />} />
              <p className={styles.wisdomLabel}>
                {wisdom.label}: {wisdom.current}/{wisdom.required}
              </p>
            </div>
          }
        />
      )}

      {/* §13.1/§13.2: current path + objective progress — no per-user
          aggregation endpoint exists yet, so this links into Learn instead
          of fabricating a completion bar. Phase 3.5 §6 WS5: CoverArt list-card
          treatment mirrors LearningHub's plan card / WS4's PracticeIntent. */}
      {activeLesson &&
        (designSystemV2 ? (
          <ContentCard
            flush
            onClick={() => navigate(`/learn/lessons/${activeLesson.lesson.id}`)}
            aria-label={activeLesson.lesson.title}
          >
            <div className={styles.lessonCard}>
              <CoverArt seed={activeLesson.lesson.id} glyph="path" className={styles.lessonCover} />
              <div className={styles.lessonMain}>
                <p className={styles.sectionLabel}>Продовжити навчання</p>
                <p className={styles.lessonTitle}>{activeLesson.lesson.title}</p>
              </div>
            </div>
          </ContentCard>
        ) : (
          <ContentCard onClick={() => navigate(`/learn/lessons/${activeLesson.lesson.id}`)}>
            <p className={styles.sectionLabel}>Продовжити навчання</p>
            <p>{activeLesson.lesson.title}</p>
          </ContentCard>
        ))}

      <MetricTileGrid>
        <MetricTile
          icon={<Icon name="brain" size={20} />}
          value={<AnimatedNumber value={masteredCount} />}
          label="тем із зафіксованим прогресом"
        />
        <MetricTile
          icon={<Icon name="clock" size={20} />}
          value={<AnimatedNumber value={reviewDue.data?.dueCount ?? 0} />}
          label="готово до повторення"
        />
      </MetricTileGrid>

      {(reviewDue.data?.dueCount ?? 0) > 0 && (
        <Button fullWidth variant="secondary" onClick={() => navigate('/review')}>
          Повторити зараз
        </Button>
      )}

      {/* §13.6: achievements — full catalog, locked ones stay visible (§17.4). */}
      <section>
        <p className={styles.sectionLabel}>Досягнення</p>
        <div className={styles.achievements}>
          {ACHIEVEMENTS.map((a) => (
            <AchievementBadge
              key={a.id}
              icon={a.icon}
              label={a.title}
              locked={!profile.achievements.includes(a.id)}
            />
          ))}
        </div>
      </section>

      {/* §13.7: recent authoritative event — Today's single latest outcome;
          there is no dedicated events-feed endpoint to list more. */}
      {today.data?.recentOutcome && (
        <ContentCard>
          <p className={styles.sectionLabel}>Останнє</p>
          <p>{today.data.recentOutcome.title}</p>
        </ContentCard>
      )}
    </AppPage>
  );
}
