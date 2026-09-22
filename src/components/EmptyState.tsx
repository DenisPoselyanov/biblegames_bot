import type { ReactNode } from 'react';
import { Empty } from 'react-vant';
import { type IconName, Icon } from './Icon';
import { isFeatureEnabled } from '../lib/flags';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon = 'info', title, description, action }: EmptyStateProps) {
  // design-v2 (proto's "Нічого не знайшли" card): a quiet outline card sized by
  // its own content, not react-vant's full-height `Empty` illustration slot.
  if (isFeatureEnabled('designSystemV2')) {
    return (
      <div className={styles.card} role="status">
        <Icon name={icon} size={22} className={styles.icon} />
        <p className={styles.title}>{title}</p>
        {description && <p className={styles.description}>{description}</p>}
        {action && <div className={styles.action}>{action}</div>}
      </div>
    );
  }

  return (
    <Empty
      image={
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 'var(--radius-full)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            margin: '0 auto',
          }}
        >
          <Icon name={icon} size={28} />
        </div>
      }
      description={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
          <h3 style={{ fontSize: 'var(--fs-lg)', color: 'var(--text)', margin: 0 }}>{title}</h3>
          {description && (
            <p
              style={{
                margin: 0,
                fontSize: 'var(--fs-md)',
                color: 'var(--text-muted)',
                maxWidth: 280,
                lineHeight: 'var(--lh-relaxed)',
              }}
            >
              {description}
            </p>
          )}
          {action && <div style={{ marginTop: '0.5rem' }}>{action}</div>}
        </div>
      }
    />
  );
}
