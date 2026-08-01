import { Loading } from 'react-vant';

interface SpinnerProps {
  size?: number;
  color?: string;
}

export function Spinner({ size = 24, color = 'var(--gold)' }: SpinnerProps) {
  return (
    <Loading
      type="spinner"
      size={size}
      color={color}
      aria-label="Завантаження"
    />
  );
}
