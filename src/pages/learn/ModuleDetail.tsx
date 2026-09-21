/**
 * Module detail (Phase 3 WS6, spec §11.2): lesson sequence. Prerequisite/lock
 * state is deliberately not shown — the server doesn't expose one yet
 * ("unlocking rules are server-driven", §11.2), and inventing a client-side
 * lock heuristic would violate that rule rather than honor it.
 *
 * Phase 3.5 §6 WS3 re-skin (behind `designSystemV2`): a smaller `CoverArt`
 * banner pulled-up over by title/pills, numbered lesson rows — same
 * "no invented lock/progress state" rule, different shell. Flag off renders
 * byte-for-byte the pre-3.5 layout.
 */
import { useNavigate, useParams } from 'react-router-dom';
import { isFeatureEnabled } from '../../lib/flags';
import { useModuleDetail } from '../../queries/useLearning';
import { AppPage, ContentCard, CoverArt, ErrorState, IconButton, ListRow, PageHeader, Pill } from '../../components/ui';
import { EmptyState } from '../../components/EmptyState';
import { ListPageSkeleton } from '../../components/skeletons';
import styles from './ModuleDetail.module.css';

export function ModuleDetail() {
  const { planId, moduleId } = useParams<{ planId: string; moduleId: string }>();
  const navigate = useNavigate();
  const { data: module_, isLoading, isError, refetch } = useModuleDetail(moduleId);
  const designSystemV2 = isFeatureEnabled('designSystemV2');

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

  if (!designSystemV2) {
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

  return (
    <AppPage>
      <div className={styles.bannerSection}>
        <div className={styles.bannerWrap}>
          <CoverArt seed={module_.id} glyph="path" className={styles.banner} />
          <IconButton icon="back" label="Назад" variant="surface" className={styles.backButton} onClick={backTo} />
        </div>
        <div className={styles.overlapContent}>
          <h1 className={styles.title}>{module_.title}</h1>
          {module_.description && <p className={styles.description}>{module_.description}</p>}
          <div className={styles.pillRow}>
            <Pill tone="accent">{module_.lessons.length} уроків</Pill>
          </div>
        </div>
      </div>

      {module_.lessons.length === 0 ? (
        <EmptyState icon="book" title="У цьому модулі ще немає уроків" />
      ) : (
        <div className={styles.lessonList}>
          {module_.lessons.map((lesson, index) => (
            <button
              key={lesson.id}
              type="button"
              className={styles.lessonRow}
              onClick={() => navigate(`/learn/lessons/${lesson.id}`)}
            >
              <span className={styles.lessonBadge}>{index + 1}</span>
              <span className={styles.lessonMain}>
                <span className={styles.lessonTitle}>{lesson.title}</span>
                {lesson.description && <span className={styles.lessonDescription}>{lesson.description}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </AppPage>
  );
}
