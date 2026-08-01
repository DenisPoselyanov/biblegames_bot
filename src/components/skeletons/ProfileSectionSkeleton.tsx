import { AppSkeleton } from './AppSkeleton';
import styles from './skeletons.module.css';

export function ProfileSectionSkeleton() {
  return (
    <div className={styles.profileMap} role="status" aria-busy="true" aria-label="Завантаження карти тем">
      <AppSkeleton title titleWidth="40%" row={4} rowWidth={['100%', '85%', '70%', '90%']} />
    </div>
  );
}
