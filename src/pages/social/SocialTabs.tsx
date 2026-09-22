import { useNavigate } from 'react-router-dom';
import { SegmentedControl } from '../../components/ui';

export type SocialTab = 'challenges' | 'communities';

const ROUTE: Record<SocialTab, string> = {
  challenges: '/social/challenges',
  communities: '/social/communities',
};

/**
 * Design-v2 (`proto/design-v2`'s `Social`): Виклики and Групи read as two
 * halves of one "Спільнота" screen. The app keeps them as two routes — this is
 * the prototype's segmented switch over that pair, not a route change.
 */
export function SocialTabs({ active }: { active: SocialTab }) {
  const navigate = useNavigate();
  return (
    <SegmentedControl
      label="Розділ спільноти"
      value={active}
      onChange={(next: SocialTab) => {
        if (next !== active) navigate(ROUTE[next]);
      }}
      options={[
        { value: 'challenges', label: 'Виклики' },
        { value: 'communities', label: 'Групи' },
      ]}
    />
  );
}
