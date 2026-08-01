import { AppSkeleton } from './AppSkeleton';
import styles from './skeletons.module.css';

export function QuizPoolSkeleton() {
  return (
    <div className={styles.status} role="status" aria-busy="true" aria-label="Завантаження питань">
      <div className={styles.quizTop}>
        <div className={styles.quizTopRow}>
          <AppSkeleton row={0} title={false} avatar avatarSize={36} avatarShape="round" />
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <div className={styles.quizBadge}>
              <AppSkeleton row={0} title={false} />
            </div>
            <div className={styles.quizBadge}>
              <AppSkeleton row={0} title={false} />
            </div>
          </div>
        </div>
        <AppSkeleton row={1} rowWidth="35%" title={false} />
      </div>
      <div className={styles.quizTimerWrap}>
        <div className={styles.quizTimer}>
          <AppSkeleton round row={0} title={false} />
        </div>
      </div>
      <div className={styles.quizPanel}>
        <div className={styles.quizQuestionCard}>
          <AppSkeleton row={2} rowWidth={['95%', '75%']} title={false} />
        </div>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={styles.quizOption}>
            <AppSkeleton row={1} rowHeight={52} title={false} round />
          </div>
        ))}
      </div>
    </div>
  );
}
