import { motion } from 'framer-motion';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from './cn';


/* ------------------------------------------------------------------ surface */

export function Card({
  children,
  className,
  tone = 'glass',
  ...rest
}: {
  children: ReactNode;
  tone?: 'glass' | 'solid' | 'outline';
} & ComponentPropsWithoutRef<'div'>) {
  const tones = {
    glass: 'bg-surface backdrop-blur-xl border border-line shadow-lift',
    solid: 'bg-surface-2 backdrop-blur-xl border border-line-strong shadow-lift',
    outline: 'border border-line',
  } as const;
  return (
    <div className={cn('rounded-card', tones[tone], className)} {...rest}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ buttons */

type ButtonProps = {
  children: ReactNode;
  variant?: 'primary' | 'onColor' | 'ghost' | 'quiet';
  size?: 'md' | 'lg';
  full?: boolean;
} & ComponentPropsWithoutRef<'button'>;

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  full,
  className,
  ...rest
}: ButtonProps) {
  const base =
    'relative inline-flex items-center justify-center gap-2 rounded-control font-semibold tracking-[-0.01em] transition-[transform,opacity,box-shadow] duration-200 active:scale-[0.975] disabled:opacity-45 disabled:active:scale-100';
  const sizes = { md: 'h-12 px-5 text-[15px]', lg: 'h-14 px-6 text-[16px]' } as const;
  const variants = {
    primary:
      'text-white bg-[linear-gradient(135deg,var(--p-indigo),var(--p-violet))] shadow-[0_16px_34px_-16px_var(--p-violet)]',
    // On a coloured card the gradient loses contrast, so the same action
    // inverts to plain white. Gold stays an accent, never a button fill.
    onColor: 'bg-white text-[#1a1430] shadow-[0_14px_30px_-14px_rgba(0,0,0,0.6)]',
    ghost: 'border border-line-strong bg-surface backdrop-blur-xl text-ink',
    quiet: 'text-muted hover:text-ink',
  } as const;
  return (
    <button
      className={cn(base, sizes[size], variants[variant], full && 'w-full', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------- atoms */

export function Pill({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'neutral' | 'gold' | 'success';
}) {
  const tones = {
    neutral: 'bg-surface border-line text-muted',
    gold: 'bg-[color-mix(in_srgb,var(--p-gold)_14%,transparent)] border-[color-mix(in_srgb,var(--p-gold)_36%,transparent)] text-gold-ink',
    success:
      'bg-[color-mix(in_srgb,var(--p-success)_14%,transparent)] border-[color-mix(in_srgb,var(--p-success)_34%,transparent)] text-success',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="font-display text-[19px] leading-tight font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function Meter({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-line-strong', className)}>
      <motion.div
        className="h-full rounded-full bg-[linear-gradient(90deg,var(--p-indigo),var(--p-violet),var(--p-ramp-end))]"
        initial={{ width: 0 }}
        animate={{ width: `${Math.round(value * 100)}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      />
    </div>
  );
}

export function Ring({
  value,
  size = 96,
  stroke = 8,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="protoRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--p-indigo)" />
            <stop offset="55%" stopColor="var(--p-violet)" />
            <stop offset="100%" stopColor="var(--p-ramp-end)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--p-line-strong)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#protoRing)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(Math.max(value, 0), 1)) }}
          transition={{ type: 'spring', stiffness: 90, damping: 18 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-full border border-line bg-surface p-1 backdrop-blur-xl">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative flex-1 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors',
              active ? 'text-ink' : 'text-faint',
            )}
          >
            {active && (
              <motion.span
                layoutId="proto-segment"
                className="absolute inset-0 rounded-full bg-surface-2 shadow-lift"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------- covers */

/**
 * Generated cover art: a soft mesh gradient built from the plan's hue plus a
 * thin line-art glyph. Keeps the prototype free of image assets while still
 * giving every plan its own identity.
 */
export function Cover({
  hue,
  className,
  glyph = 'rays',
  fade = true,
  scrim = false,
}: {
  hue: number;
  className?: string;
  glyph?: 'rays' | 'path' | 'wave';
  /** Bottom fade into the canvas — off when the cover fills a whole card. */
  fade?: boolean;
  /** Darkens the lower half so light text stays readable on top of the art. */
  scrim?: boolean;
}) {
  const id = `cov${hue}${glyph}`;
  // Callers that stretch the cover behind a whole card pass `absolute`; adding
  // our own `relative` would fight it (class order in the file, not in the
  // attribute, decides the winner) and drop the art back into the flow.
  const stretched = className?.includes('absolute');
  return (
    <div className={cn(!stretched && 'relative', 'overflow-hidden', className)}>
      <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <defs>
          <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={`hsl(${hue} 72% 32%)`} />
            <stop offset="60%" stopColor={`hsl(${hue + 26} 64% 22%)`} />
            <stop offset="100%" stopColor={`hsl(${hue + 50} 58% 16%)`} />
          </linearGradient>
          <radialGradient id={`${id}-glow`} cx="0.72" cy="0.18" r="0.7">
            <stop offset="0%" stopColor="rgba(255,225,170,0.85)" />
            <stop offset="55%" stopColor="rgba(255,205,120,0.15)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <rect width="320" height="180" fill={`url(#${id}-bg)`} />
        <rect width="320" height="180" fill={`url(#${id}-glow)`} />
        <g stroke="rgba(255,244,220,0.34)" strokeWidth="1" fill="none">
          {glyph === 'rays' &&
            Array.from({ length: 9 }).map((_, i) => (
              <line key={i} x1="230" y1="34" x2={40 + i * 34} y2="196" />
            ))}
          {glyph === 'path' && (
            <>
              <path d="M-10 150 C 70 120, 90 70, 170 60 S 290 30, 340 10" />
              <path d="M-10 172 C 80 146, 110 96, 190 86 S 300 56, 340 36" opacity="0.6" />
            </>
          )}
          {glyph === 'wave' &&
            Array.from({ length: 5 }).map((_, i) => (
              <path
                key={i}
                d={`M-10 ${70 + i * 26} C 60 ${50 + i * 26}, 120 ${96 + i * 26}, 200 ${74 + i * 26} S 300 ${44 + i * 26}, 340 ${64 + i * 26}`}
                opacity={0.8 - i * 0.13}
              />
            ))}
        </g>
      </svg>
      {fade && (
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_38%,color-mix(in_srgb,var(--p-canvas)_78%,transparent))]" />
      )}
      {scrim && (
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,7,24,0.18)_0%,rgba(9,7,24,0.62)_58%,rgba(9,7,24,0.88)_100%)]" />
      )}
    </div>
  );
}
