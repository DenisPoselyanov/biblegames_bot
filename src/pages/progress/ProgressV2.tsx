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
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthSession } from '../../context/AuthSessionContext';
import { useTopicHierarchies } from '../../context/TopicHierarchyContext';
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
  ProgressBar,
  ProgressRing,
  SectionHeader,
  cx,
} from '../../components/ui';
import { Icon } from '../../components/Icon';
import type { TopicNode } from '../../types';
import styles from './ProgressV2.module.css';

/**
 * Per-root-topic mastery (design-v2 "Майстерність за темами", proto
 * `Progress`). Averages the *answered* descendants of each root topic — a
 * topic nobody has practised yet contributes nothing rather than dragging the
 * average down, and roots with no answers at all are dropped instead of
 * rendering an empty bar.
 */
function masteryByTopic(
  hierarchies: Record<string, TopicNode> | null,
  studyMastery: Record<string, { mastery: number; totalAnswers: number }>,
): Array<{ id: string; title: string; value: number }> {
  if (!hierarchies) return [];
  const rows: Array<{ id: string; title: string; value: number }> = [];
  for (const root of Object.values(hierarchies)) {
    let sum = 0;
    let count = 0;
    const visit = (node: TopicNode) => {
      const state = studyMastery[node.id];
      if (state && state.totalAnswers > 0) {
        sum += state.mastery;
        count += 1;
      }
      node.children?.forEach(visit);
    };
    visit(root);
    if (count > 0) rows.push({ id: root.id, title: root.title, value: sum / count / 100 });
  }
  return rows.sort((a, b) => b.value - a.value).slice(0, 6);
}

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
  const { hierarchies } = useTopicHierarchies();
  const mastery = useMemo(
    () => masteryByTopic(hierarchies, profile.studyMastery ?? {}),
    [hierarchies, profile.studyMastery],
  );

  return (
    <AppPage className={styles.page}>
      <PageHeader title="Прогрес" description="Що вже міцно, а що почало забуватися" />

      {/* §13.5: level/rank summary — server-authoritative playerRank.
          Phase 3.5 §6 WS5: `tone="cover"` reuses WS3's hero-card pattern
          (§4 "screen's main object" rule) instead of the flat surface card;
          same data, no new fields. */}
      {designSystemV2 ? (
        /* Phase 3.5 §6: the prototype opens Progress with a quiet glass
           summary — a rank ring plus a short list of numbers — not a
           full-bleed cover. The cover hero is reserved for a screen's
           *actionable* main object (Урок дня / Гра тижня), which Progress
           does not have. */
        <ContentCard className={styles.summaryCard}>
          <ProgressRing
            value={wisdomPct}
            size={92}
            centerLabel={
              <span className={styles.ringCenter}>
                <span className={styles.ringValue}>{profile.playerRank.plaque}</span>
                <span className={styles.ringCaption}>плашка</span>
              </span>
            }
          />
          <div className={styles.summaryRows}>
            <SummaryRow icon="award" label="Ранг" value={rankLabel} />
            <SummaryRow icon="zap" label="Мудрість" value={String(profile.playerRank.wisdomPoints)} />
            <SummaryRow icon="fire" label="Серія" value={`${profile.streakDays} дн.`} />
            <SummaryRow icon="coins" label="Монети" value={String(profile.coins)} />
          </div>
        </ContentCard>
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

      {/* Design-v2 "Майстерність за темами" (proto `Progress`) — real
          per-topic mastery from `studyMastery`, nothing invented. Hidden
          entirely until at least one topic has answers. */}
      {designSystemV2 && mastery.length > 0 && (
        <section>
          <SectionHeader title="Майстерність за темами" />
          <ContentCard className={styles.masteryCard}>
            {mastery.map((row) => (
              <div key={row.id} className={styles.masteryRow}>
                <div className={styles.masteryHead}>
                  <span className={styles.masteryTitle}>{row.title}</span>
                  <span
                    className={cx(
                      styles.masteryValue,
                      row.value >= 0.7
                        ? styles.masteryStrong
                        : row.value >= 0.4
                          ? styles.masteryMid
                          : styles.masteryWeak,
                    )}
                  >
                    {Math.round(row.value * 100)}%
                  </span>
                </div>
                <ProgressBar value={row.value * 100} />
              </div>
            ))}
          </ContentCard>
        </section>
      )}

      {/* §13.6: achievements — full catalog, locked ones stay visible (§17.4). */}
      <section>
        {designSystemV2 ? (
          <SectionHeader title="Досягнення" />
        ) : (
          <p className={styles.sectionLabel}>Досягнення</p>
        )}
        <div className={cx(styles.achievements, designSystemV2 && styles.achievementsGrid)}>
          {ACHIEVEMENTS.map((a) => (
            <AchievementBadge
              key={a.id}
              icon={a.icon}
              label={a.title}
              locked={!profile.achievements.includes(a.id)}
              card={designSystemV2}
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

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: 'award' | 'zap' | 'fire' | 'coins';
  label: string;
  value: string;
}) {
  return (
    <div className={styles.summaryRow}>
      <Icon name={icon} size={14} className={styles.summaryIcon} />
      <span className={styles.summaryLabel}>{label}</span>
      <span className={styles.summaryValue}>{value}</span>
    </div>
  );
}
