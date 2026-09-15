/**
 * Plan detail (Phase 3 WS6, spec §11.1): purpose/description, module list.
 * `PlanDetail` (`contracts/api/learning.ts`) carries no per-user progress or
 * completion/mastery aggregation yet — WS2 doesn't compute or expose one, so
 * this view shows structure only rather than fabricating a progress bar (same
 * rule already applied to `optionalChallenge` and estimated effort). A
 * per-user plan-progress endpoint is a natural WS7-adjacent follow-up.
 */
import { useNavigate, useParams } from 'react-router-dom';
import { usePlanDetail } from '../../queries/useLearning';
import { AppPage, ContentCard, ErrorState, ListRow, PageHeader } from '../../components/ui';
import { EmptyState } from '../../components/EmptyState';
import { ListPageSkeleton } from '../../components/skeletons';

export function PlanDetail() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { data: plan, isLoading, isError, refetch } = usePlanDetail(planId);

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
