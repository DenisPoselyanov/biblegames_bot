/**
 * Practice session intent picker (Phase 3 WS7, spec §12.1): pick a published
 * plan → module → lesson, then start a `mode: 'practice'` session scoped to
 * that lesson's objective. There is no flat "all objectives" list endpoint
 * (WS2 doesn't expose one) so entry drills through the same plan/module
 * hierarchy Learn already reads — no new server surface needed.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCreatePracticeSession, useModuleDetail, usePlanDetail, usePublishedPlans } from '../../queries/useLearning';
import { queryKeys } from '../../queries/keys';
import { AppPage, ContentCard, ErrorState, ListRow, PageHeader } from '../../components/ui';
import { EmptyState } from '../../components/EmptyState';
import { ListPageSkeleton } from '../../components/skeletons';

export function PracticeIntent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [planId, setPlanId] = useState<string | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [pendingObjectiveId, setPendingObjectiveId] = useState<string | null>(null);

  const plans = usePublishedPlans();
  const plan = usePlanDetail(planId ?? undefined);
  const module_ = useModuleDetail(moduleId ?? undefined);
  const createSession = useCreatePracticeSession();

  function startPractice(objectiveId: string) {
    if (createSession.isPending) return;
    setPendingObjectiveId(objectiveId);
    createSession.mutate(
      { objectiveId, mode: 'practice' },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(queryKeys.practice.session(data.session.id), data);
          navigate(`/practice/session/${data.session.id}`);
        },
      },
    );
  }

  if (moduleId) {
    return (
      <AppPage>
        <PageHeader onBack={() => setModuleId(null)} title="Оберіть урок" />
        {module_.isLoading && <ListPageSkeleton cards={3} />}
        {module_.isError && (
          <ErrorState title="Не вдалося завантажити модуль" onRetry={() => void module_.refetch()} />
        )}
        {module_.data && module_.data.lessons.length === 0 && (
          <EmptyState icon="brain" title="У цьому модулі ще немає уроків" />
        )}
        {module_.data && module_.data.lessons.length > 0 && (
          <ContentCard flush>
            {module_.data.lessons.map((lesson) => (
              <ListRow
                key={lesson.id}
                title={lesson.title}
                subtitle={lesson.description ?? undefined}
                navigates
                onClick={() => startPractice(lesson.objectiveId)}
              />
            ))}
          </ContentCard>
        )}
        {createSession.isError && (
          <ErrorState
            title="Не вдалося створити сесію"
            onRetry={pendingObjectiveId ? () => startPractice(pendingObjectiveId) : undefined}
          />
        )}
      </AppPage>
    );
  }

  if (planId) {
    return (
      <AppPage>
        <PageHeader onBack={() => setPlanId(null)} title="Оберіть модуль" />
        {plan.isLoading && <ListPageSkeleton cards={3} />}
        {plan.isError && <ErrorState title="Не вдалося завантажити план" onRetry={() => void plan.refetch()} />}
        {plan.data && plan.data.modules.length === 0 && (
          <EmptyState icon="brain" title="У цьому плані ще немає модулів" />
        )}
        {plan.data && plan.data.modules.length > 0 && (
          <ContentCard flush>
            {plan.data.modules.map((m) => (
              <ListRow
                key={m.id}
                title={m.title}
                subtitle={m.description ?? undefined}
                navigates
                onClick={() => setModuleId(m.id)}
              />
            ))}
          </ContentCard>
        )}
      </AppPage>
    );
  }

  return (
    <AppPage>
      <PageHeader kicker="Практика" title="Що потренуємо?" />
      {plans.isLoading && <ListPageSkeleton cards={3} />}
      {plans.isError && <ErrorState title="Не вдалося завантажити плани" onRetry={() => void plans.refetch()} />}
      {plans.data && plans.data.length === 0 && (
        <EmptyState icon="brain" title="Ще немає опублікованих планів" description="Спробуйте пізніше." />
      )}
      {plans.data && plans.data.length > 0 && (
        <ContentCard flush>
          {plans.data.map((p) => (
            <ListRow
              key={p.id}
              title={p.title}
              subtitle={p.description ?? undefined}
              navigates
              onClick={() => setPlanId(p.id)}
            />
          ))}
        </ContentCard>
      )}
    </AppPage>
  );
}
