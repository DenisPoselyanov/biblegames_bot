/**
 * Review hub (Phase 3 WS7, spec §12.5): due count, plain-language reason per
 * item, no fake scientific precision. Picking an item starts a `mode:
 * 'review'` practice session scoped to that objective — a distinct flow from
 * Today's "continue lesson" review shortcut (WS6), which resumes the lesson
 * itself rather than a quiz-style review session.
 */
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthSession } from '../../context/AuthSessionContext';
import { useCreatePracticeSession, useReviewDue } from '../../queries/useLearning';
import { queryKeys } from '../../queries/keys';
import { AppPage, ContentCard, ErrorState, ListRow, PageHeader } from '../../components/ui';
import { EmptyState } from '../../components/EmptyState';
import { ListPageSkeleton } from '../../components/skeletons';
import type { ReviewCard } from '../../../contracts/api/learning';

const REASON_LABEL: Record<ReviewCard['reason'], string> = {
  missed_recently: 'Нещодавно була помилка',
  spaced_interval: 'Час повторити за розкладом',
};

export function ReviewHub() {
  const navigate = useNavigate();
  const { userId } = useAuthSession();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useReviewDue(userId);
  const createSession = useCreatePracticeSession();

  function startReview(item: ReviewCard) {
    if (createSession.isPending) return;
    createSession.mutate(
      { objectiveId: item.objectiveId, mode: 'review' },
      {
        onSuccess: (result) => {
          queryClient.setQueryData(queryKeys.practice.session(result.session.id), result);
          navigate(`/practice/session/${result.session.id}`);
        },
      },
    );
  }

  return (
    <AppPage>
      <PageHeader
        kicker="Повторення"
        title={data ? `Готово до повторення: ${data.dueCount}` : 'Повторення'}
      />

      {isLoading && <ListPageSkeleton cards={3} />}
      {isError && <ErrorState title="Не вдалося завантажити список повторення" onRetry={() => void refetch()} />}
      {data && data.items.length === 0 && (
        <EmptyState icon="clock" title="Немає елементів для повторення" description="Поверніться пізніше." />
      )}
      {data && data.items.length > 0 && (
        <ContentCard flush>
          {data.items.map((item) => (
            <ListRow
              key={item.objectiveId}
              title={item.title}
              subtitle={REASON_LABEL[item.reason]}
              navigates
              onClick={() => startReview(item)}
            />
          ))}
        </ContentCard>
      )}
      {createSession.isError && <ErrorState title="Не вдалося створити сесію повторення" />}
    </AppPage>
  );
}
