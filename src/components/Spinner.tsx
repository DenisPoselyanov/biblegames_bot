interface SpinnerProps {
  size?: number;
  color?: string;
}

export function Spinner({ size = 24, color = 'var(--gold)' }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Завантаження"
      style={{
        width: size,
        height: size,
        border: '2px solid var(--border)',
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }}
    />
  );
}
