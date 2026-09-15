import type { IconName } from '../Icon';
import { Icon } from '../Icon';
import { cx } from './cx';
import styles from './BottomNavigation.module.css';

export interface BottomNavigationItem<T extends string> {
  key: T;
  icon: IconName;
  label: string;
}

interface BottomNavigationProps<T extends string> {
  items: BottomNavigationItem<T>[];
  active: T;
  onSelect: (key: T) => void;
  /** Also renders a same-height spacer so fixed nav doesn't cover page content — mirrors react-vant's `placeholder`. */
  withPlaceholder?: boolean;
  className?: string;
}

/**
 * Presentational bottom nav (DESIGN_RULES §10/§14): one continuous surface,
 * no stray dividers, stable icon/label layout, safe-area bottom. Standalone
 * for now — WS5 owns wiring this into the route shell / replacing
 * `Layout.tsx`'s current react-vant `Tabbar`.
 */
export function BottomNavigation<T extends string>({
  items,
  active,
  onSelect,
  withPlaceholder,
  className,
}: BottomNavigationProps<T>) {
  return (
    <>
      <nav className={cx(styles.nav, className)} aria-label="Основна навігація">
        <div className={styles.inner}>
          {items.map((item) => {
            const isActive = item.key === active;
            return (
              <button
                key={item.key}
                type="button"
                className={cx(styles.item, isActive && styles['item--active'])}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelect(item.key)}
              >
                <span className={styles.iconBox}>
                  <Icon name={item.icon} size={22} />
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      {withPlaceholder && <div className={styles.placeholder} aria-hidden="true" />}
    </>
  );
}
