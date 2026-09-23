import { Hammer } from 'lucide-react';
import { EmptyState, Page } from '../ui/kit';

/** Placeholder for screens that ship in a later WS8 sub-workstream (WS8b/c/d). */
export function ComingSoon({ title }: { title: string }) {
  return (
    <Page title={title}>
      <EmptyState
        icon={<Hammer size={18} />}
        title="Ще будується"
        body="Цей екран студії з'явиться в наступній частині WS8."
      />
    </Page>
  );
}
