import { AppSkeleton } from './AppSkeleton';
import styles from './skeletons.module.css';

interface ListPageSkeletonProps {
  cards?: number;
}

export function ListPageSkeleton({ cards = 4 }: ListPageSkeletonProps) {
  return (
    <div className={styles.status}>
      <div className={styles.listHeader}>
        <AppSkeleton title titleWidth="55%" row={1} rowWidth="80%" />
      </div>
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className={styles.cardRow}>
          <AppSkeleton avatar avatarSize={40} title row={2} rowWidth={['70%', '90%']} />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className={styles.cardRow}>
      <AppSkeleton title row={2} rowWidth={['60%', '100%']} />
    </div>
  );
}
