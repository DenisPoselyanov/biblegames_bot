import { AppPage } from '../ui';
import { EmptyState } from '../EmptyState';
import type { IconName } from '../Icon';

interface ComingSoonProps {
  icon?: IconName;
  title: string;
  description?: string;
}

/**
 * Placeholder for a v2 canonical route (§5.1) that doesn't have a real WS6-9
 * implementation yet — deliberately not faking content. Replaced page-by-page as
 * Today/Learning-hub/lesson (WS6), practice/review (WS7), profile/settings (WS8)
 * land.
 */
export function ComingSoon({ icon = 'clock', title, description }: ComingSoonProps) {
  return (
    <AppPage>
      <EmptyState
        icon={icon}
        title={title}
        description={description ?? 'Цей розділ ще будується. Слідкуйте за оновленнями.'}
      />
    </AppPage>
  );
}
