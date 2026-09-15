/**
 * Learning hub (Phase 3 WS6, spec §10). Browses published plans (`GET
 * /learning/plans`) and, once a query is typed, searches published
 * plans/objectives server-side (`GET /learning/search`, §10.2) — never a
 * client-side scan of the full content JSON. The testament filter (§10.3) is
 * URL/query-state so it survives a deep link/reload.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Testament } from '../../../contracts/index';
import { usePublishedPlans, useLearningSearch } from '../../queries/useLearning';
import {
  AppPage,
  ContentCard,
  ErrorState,
  ListRow,
  PageHeader,
  SearchField,
  SegmentedControl,
} from '../../components/ui';
import { EmptyState } from '../../components/EmptyState';
import { ListPageSkeleton } from '../../components/skeletons';

type TestamentFilter = 'all' | Testament;

const TESTAMENT_OPTIONS: [
  { value: TestamentFilter; label: string },
  { value: TestamentFilter; label: string },
  { value: TestamentFilter; label: string },
] = [
  { value: 'all', label: 'Усі' },
  { value: 'old_testament', label: 'Старий Завіт' },
  { value: 'new_testament', label: 'Новий Завіт' },
];

const SEARCH_DEBOUNCE_MS = 300;

export function LearningHub() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const testamentParam = searchParams.get('testament');
  const testament: TestamentFilter =
    testamentParam === 'old_testament' || testamentParam === 'new_testament' ? testamentParam : 'all';
  const qParam = searchParams.get('q') ?? '';

  const [qInput, setQInput] = useState(qParam);
  const [debouncedQ, setDebouncedQ] = useState(qParam);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(qInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [qInput]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (debouncedQ) next.set('q', debouncedQ);
    else next.delete('q');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only `q` drives this sync, not every param change
  }, [debouncedQ]);

  const effectiveTestament = testament === 'all' ? undefined : testament;
  const searching = debouncedQ.trim().length >= 2;

  const plansQuery = usePublishedPlans(effectiveTestament);
  const searchQuery = useLearningSearch(debouncedQ, effectiveTestament);

  function setTestament(next: TestamentFilter) {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('testament');
    else params.set('testament', next);
    setSearchParams(params, { replace: true });
  }

  return (
    <AppPage>
      <PageHeader kicker="Навчання" title="Розділ навчання" />

      <SearchField value={qInput} onChange={setQInput} placeholder="Пошук планів і тем" />
      <SegmentedControl options={TESTAMENT_OPTIONS} value={testament} onChange={setTestament} label="Завіт" />

      {searching ? (
        <SearchResults
          isLoading={searchQuery.isLoading}
          isError={searchQuery.isError}
          onRetry={() => void searchQuery.refetch()}
          items={searchQuery.data?.items ?? []}
          onOpenPlan={(id) => navigate(`/learn/plans/${id}`)}
        />
      ) : (
        <PlanBrowseList
          isLoading={plansQuery.isLoading}
          isError={plansQuery.isError}
          onRetry={() => void plansQuery.refetch()}
          plans={plansQuery.data ?? []}
          onOpenPlan={(id) => navigate(`/learn/plans/${id}`)}
        />
      )}
    </AppPage>
  );
}

function PlanBrowseList({
  isLoading,
  isError,
  onRetry,
  plans,
  onOpenPlan,
}: {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  plans: Array<{ id: string; title: string; description: string | null }>;
  onOpenPlan: (id: string) => void;
}) {
  if (isLoading) return <ListPageSkeleton cards={4} />;
  if (isError) return <ErrorState title="Не вдалося завантажити плани" onRetry={onRetry} />;
  if (plans.length === 0) {
    return <EmptyState icon="book" title="Поки немає доступних планів" description="Нові плани з'являться найближчим часом." />;
  }
  return (
    <ContentCard flush>
      {plans.map((plan) => (
        <ListRow
          key={plan.id}
          title={plan.title}
          subtitle={plan.description ?? undefined}
          navigates
          onClick={() => onOpenPlan(plan.id)}
        />
      ))}
    </ContentCard>
  );
}

function SearchResults({
  isLoading,
  isError,
  onRetry,
  items,
  onOpenPlan,
}: {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  items: Array<
    | { kind: 'plan'; id: string; title: string; description: string | null }
    | { kind: 'objective'; id: string; planId: string; title: string; description: string | null; topicPath: string | null }
  >;
  onOpenPlan: (id: string) => void;
}) {
  if (isLoading) return <ListPageSkeleton cards={3} />;
  if (isError) return <ErrorState title="Пошук не вдався" onRetry={onRetry} />;
  if (items.length === 0) {
    return <EmptyState icon="search" title="Нічого не знайдено" description="Спробуйте інший запит." />;
  }
  return (
    <ContentCard flush>
      {items.map((item) => (
        <ListRow
          key={`${item.kind}:${item.id}`}
          title={item.title}
          subtitle={item.kind === 'objective' ? (item.topicPath ?? undefined) : (item.description ?? undefined)}
          navigates
          onClick={() => onOpenPlan(item.kind === 'plan' ? item.id : item.planId)}
        />
      ))}
    </ContentCard>
  );
}
