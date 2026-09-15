import { EmptyState } from '../EmptyState';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

/** Retryable error state (§25.2). Built on the existing `EmptyState` primitive — no duplicate layout. */
export function ErrorState({
  title = 'Щось пішло не так',
  description = 'Спробуйте ще раз за мить.',
  onRetry,
}: ErrorStateProps) {
  return (
    <EmptyState
      icon="error"
      title={title}
      description={description}
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
