import { useEffect } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  format?: (rounded: number) => string;
  className?: string;
}

function formatValue(v: number, format?: (rounded: number) => string): string {
  const rounded = Math.round(v);
  return format ? format(rounded) : rounded.toLocaleString('uk-UA');
}

/** Counts up/down to `value` on change. Renders the plain final value under reduced motion (§15.2). */
export function AnimatedNumber({ value, format, className }: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, { stiffness: 120, damping: 22, restDelta: 0.5 });
  const display = useTransform(spring, (v: number) => formatValue(v, format));

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  if (reduced) {
    return <span className={className}>{formatValue(value, format)}</span>;
  }

  return <motion.span className={className}>{display}</motion.span>;
}
