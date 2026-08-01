import { useReducedMotion } from 'framer-motion';
import { Skeleton, type SkeletonProps } from 'react-vant';

interface AppSkeletonProps extends SkeletonProps {
  label?: string;
}

export function AppSkeleton({ label = 'Завантаження', animate, ...props }: AppSkeletonProps) {
  const reduced = useReducedMotion();
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      <Skeleton loading animate={reduced ? false : animate ?? true} {...props} />
    </div>
  );
}
