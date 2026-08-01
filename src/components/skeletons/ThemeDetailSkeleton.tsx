import { AppSkeleton } from './AppSkeleton';
import styles from './skeletons.module.css';

export function ThemeDetailSkeleton() {
  return (
    <div className={styles.status}>
      <AppSkeleton title titleWidth="50%" row={2} rowWidth={['90%', '65%']} />
      <div className={styles.diffGrid}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={styles.diffCard}>
            <AppSkeleton title titleWidth="70%" row={1} rowWidth="40%" />
          </div>
        ))}
      </div>
    </div>
  );
}
