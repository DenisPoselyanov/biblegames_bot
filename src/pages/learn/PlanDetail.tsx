/**
 * Plan detail (Phase 3 WS6, spec §11.1): purpose/description, module list.
 * `PlanDetail` (`contracts/api/learning.ts`) carries no per-user progress or
 * completion/mastery aggregation yet — WS2 doesn't compute or expose one, so
 * this view shows structure only rather than fabricating a progress bar (same
 * rule already applied to `optionalChallenge` and estimated effort). A
 * per-user plan-progress endpoint is a natural WS7-adjacent follow-up.
 *
 * Phase 3.5 §6 WS3 re-skin (behind `designSystemV2`): a full-bleed `CoverArt`
 * banner with the title/pills pulled up over it, and a numbered module list —
 * same "no invented progress/lock state" rule as the legacy render, just a
 * different shell. Flag off renders byte-for-byte the pre-3.5 layout.
 */
import { useNavigate, useParams } from 'react-router-dom';
import type { Testament } from '../../../contracts/index';
import { isFeatureEnabled } from '../../lib/flags';
import { usePlanDetail } from '../../queries/useLearning';
import { AppPage, ContentCard, CoverArt, ErrorState, IconButton, ListRow, PageHeader, Pill } from '../../components/ui';
import { EmptyState } from '../../components/EmptyState';
import { ListPageSkeleton } from '../../components/skeletons';
import styles from './PlanDetail.module.css';

const TESTAMENT_LABEL: Record<Testament, string> = {
  old_testament: 'Старий Завіт',
  new_testament: 'Новий Завіт',
};

export function PlanDetail() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { data: plan, isLoading, isError, refetch } = usePlanDetail(planId);
  const designSystemV2 = isFeatureEnabled('designSystemV2');

  if (isLoading) {
    return (
      <AppPage>
        <PageHeader onBack={() => navigate('/learn')} title="План" />
        <ListPageSkeleton cards={3} />
      </AppPage>
    );
  }

  if (isError) {
    return (
      <AppPage>
        <PageHeader onBack={() => navigate('/learn')} title="План" />
        <ErrorState title="Не вдалося завантажити план" onRetry={() => void refetch()} />
      </AppPage>
    );
  }

  if (!plan) {
    return (
      <AppPage>
        <PageHeader onBack={() => navigate('/learn')} title="План" />
        <EmptyState icon="book" title="План не знайдено" description="Можливо, його ще не опубліковано." />
      </AppPage>
    );
  }

  if (!designSystemV2) {
    return (
      <AppPage>
        <PageHeader onBack={() => navigate('/learn')} title={plan.title} description={plan.description ?? undefined} />

        {plan.modules.length === 0 ? (
          <EmptyState icon="book" title="У цьому плані ще немає модулів" />
        ) : (
          <ContentCard flush>
            {plan.modules.map((module_) => (
              <ListRow
                key={module_.id}
                title={module_.title}
                subtitle={module_.description ?? undefined}
                navigates
                onClick={() => navigate(`/learn/plans/${plan.id}/modules/${module_.id}`)}
              />
            ))}
          </ContentCard>
        )}
      </AppPage>
    );
  }

  return (
    <AppPage>
      <div className={styles.bannerSection}>
        <div className={styles.bannerWrap}>
          <CoverArt seed={plan.id} glyph="rays" className={styles.banner} />
          <IconButton
            icon="back"
            label="Назад"
            variant="surface"
            className={styles.backButton}
            onClick={() => navigate('/learn')}
          />
        </div>
        <div className={styles.overlapContent}>
          <h1 className={styles.title}>{plan.title}</h1>
          {plan.description && <p className={styles.description}>{plan.description}</p>}
          <div className={styles.pillRow}>
            {plan.testament && <Pill>{TESTAMENT_LABEL[plan.testament]}</Pill>}
            <Pill tone="accent">{plan.modules.length} модулів</Pill>
          </div>
        </div>
      </div>

      {plan.modules.length === 0 ? (
        <EmptyState icon="book" title="У цьому плані ще немає модулів" />
      ) : (
        <div className={styles.moduleList}>
          {plan.modules.map((module_, index) => (
            <button
              key={module_.id}
              type="button"
              className={styles.moduleRow}
              onClick={() => navigate(`/learn/plans/${plan.id}/modules/${module_.id}`)}
            >
              <span className={styles.moduleBadge}>{index + 1}</span>
              <span className={styles.moduleMain}>
                <span className={styles.moduleTitle}>{module_.title}</span>
                {module_.description && <span className={styles.moduleDescription}>{module_.description}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </AppPage>
  );
}
