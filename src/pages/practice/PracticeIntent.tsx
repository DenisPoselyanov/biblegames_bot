/**
 * Practice session intent picker (Phase 3 WS7, spec §12.1): pick a published
 * plan → module → lesson, then start a `mode: 'practice'` session scoped to
 * that lesson's objective. There is no flat "all objectives" list endpoint
 * (WS2 doesn't expose one) so entry drills through the same plan/module
 * hierarchy Learn already reads — no new server surface needed.
 *
 * Phase 3.5 §6 WS4 re-skin (behind `designSystemV2`): the plan step gets the
 * same `CoverArt` list-card treatment as `LearningHub`'s plan browse list;
 * the module/lesson steps get the same numbered-row treatment `PlanDetail`/
 * `ModuleDetail` already use for their nested lists — this screen drills
 * through the identical plan→module→lesson hierarchy, so it reuses the same
 * visual language rather than inventing a new one. Flag off renders
 * byte-for-byte the pre-3.5 layout.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCreatePracticeSession, useModuleDetail, usePlanDetail, usePublishedPlans } from '../../queries/useLearning';
import { queryKeys } from '../../queries/keys';
import { isFeatureEnabled } from '../../lib/flags';
import { AppPage, ContentCard, CoverArt, ErrorState, ListRow, PageHeader } from '../../components/ui';
import { EmptyState } from '../../components/EmptyState';
import { ListPageSkeleton } from '../../components/skeletons';
import styles from './PracticeIntent.module.css';

export function PracticeIntent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const designSystemV2 = isFeatureEnabled('designSystemV2');
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
          designSystemV2 ? (
            <div className={styles.numberedList}>
              {module_.data.lessons.map((lesson, index) => (
                <button
                  key={lesson.id}
                  type="button"
                  className={styles.numberedRow}
                  onClick={() => startPractice(lesson.objectiveId)}
                >
                  <span className={styles.numberedBadge}>{index + 1}</span>
                  <span className={styles.numberedMain}>
                    <span className={styles.numberedTitle}>{lesson.title}</span>
                    {lesson.description && (
                      <span className={styles.numberedDescription}>{lesson.description}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          ) : (
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
          )
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
          designSystemV2 ? (
            <div className={styles.numberedList}>
              {plan.data.modules.map((m, index) => (
                <button key={m.id} type="button" className={styles.numberedRow} onClick={() => setModuleId(m.id)}>
                  <span className={styles.numberedBadge}>{index + 1}</span>
                  <span className={styles.numberedMain}>
                    <span className={styles.numberedTitle}>{m.title}</span>
                    {m.description && <span className={styles.numberedDescription}>{m.description}</span>}
                  </span>
                </button>
              ))}
            </div>
          ) : (
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
          )
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
        designSystemV2 ? (
          <div className={styles.planList}>
            {plans.data.map((p) => (
              <ContentCard key={p.id} flush onClick={() => setPlanId(p.id)} aria-label={p.title}>
                <div className={styles.planCard}>
                  <CoverArt seed={p.id} className={styles.planCover} />
                  <div className={styles.planMain}>
                    <h2 className={styles.planTitle}>{p.title}</h2>
                    {p.description && <p className={styles.planDescription}>{p.description}</p>}
                  </div>
                </div>
              </ContentCard>
            ))}
          </div>
        ) : (
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
        )
      )}
    </AppPage>
  );
}
