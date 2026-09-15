/**
 * Module detail (Phase 3 WS6, spec §11.2): lesson sequence. Prerequisite/lock
 * state is deliberately not shown — the server doesn't expose one yet
 * ("unlocking rules are server-driven", §11.2), and inventing a client-side
 * lock heuristic would violate that rule rather than honor it.
 */
import { useNavigate, useParams } from 'react-router-dom';
import { useModuleDetail } from '../../queries/useLearning';
import { AppPage, ContentCard, ErrorState, ListRow, PageHeader } from '../../components/ui';
import { EmptyState } from '../../components/EmptyState';
import { ListPageSkeleton } from '../../components/skeletons';

export function ModuleDetail() {
  const { planId, moduleId } = useParams<{ planId: string; moduleId: string }>();
  const navigate = useNavigate();
  const { data: module_, isLoading, isError, refetch } = useModuleDetail(moduleId);

  const backTo = () => navigate(planId ? `/learn/plans/${planId}` : '/learn');

  if (isLoading) {
    return (
      <AppPage>
        <PageHeader onBack={backTo} title="Модуль" />
        <ListPageSkeleton cards={3} />
      </AppPage>
    );
  }

  if (isError) {
    return (
      <AppPage>
        <PageHeader onBack={backTo} title="Модуль" />
        <ErrorState title="Не вдалося завантажити модуль" onRetry={() => void refetch()} />
      </AppPage>
    );
  }

  if (!module_) {
    return (
      <AppPage>
        <PageHeader onBack={backTo} title="Модуль" />
        <EmptyState icon="book" title="Модуль не знайдено" description="Можливо, його ще не опубліковано." />
      </AppPage>
    );
  }

  return (
    <AppPage>
      <PageHeader onBack={backTo} title={module_.title} description={module_.description ?? undefined} />

      {module_.lessons.length === 0 ? (
        <EmptyState icon="book" title="У цьому модулі ще немає уроків" />
      ) : (
        <ContentCard flush>
          {module_.lessons.map((lesson) => (
            <ListRow
              key={lesson.id}
              title={lesson.title}
              subtitle={lesson.description ?? undefined}
              navigates
              onClick={() => navigate(`/learn/lessons/${lesson.id}`)}
            />
          ))}
        </ContentCard>
      )}
    </AppPage>
  );
}
