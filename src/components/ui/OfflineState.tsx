import { EmptyState } from '../EmptyState';
import { Button } from './Button';

interface OfflineStateProps {
  onRetry?: () => void;
}

/** No-connection state (§25.2). Built on the existing `EmptyState` primitive. */
export function OfflineState({ onRetry }: OfflineStateProps) {
  return (
    <EmptyState
      icon="wifi-off"
      title="Немає з’єднання"
      description="Перевірте інтернет-з’єднання і спробуйте ще раз."
      action={
        onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Повторити
          </Button>
        )
      }
    />
  );
}
