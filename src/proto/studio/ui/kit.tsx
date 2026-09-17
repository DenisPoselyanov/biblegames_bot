import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '../../ui/cn';

/* ------------------------------------------------------------------ status */

type Tone = 'neutral' | 'info' | 'gold' | 'success' | 'danger';

/**
 * One vocabulary for every state the studio shows — draft lifecycle, job
 * lifecycle, check severity, Scripture verdict, provider health. Same word in
 * two places always gets the same colour, so a red dot never needs a legend.
 */
const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  // draft lifecycle
  draft: { label: 'Чернетка', tone: 'neutral' },
  generated: { label: 'Згенеровано', tone: 'info' },
  validation_failed: { label: 'Валідація провалена', tone: 'danger' },
  ready_for_review: { label: 'На ревʼю', tone: 'gold' },
  changes_requested: { label: 'Потребує змін', tone: 'gold' },
  approved: { label: 'Схвалено', tone: 'success' },
  scheduled: { label: 'Заплановано', tone: 'info' },
  published: { label: 'Опубліковано', tone: 'success' },
  superseded: { label: 'Замінено', tone: 'neutral' },
  archived: { label: 'В архіві', tone: 'neutral' },
  rolled_back: { label: 'Відкочено', tone: 'danger' },
  // jobs
  queued: { label: 'У черзі', tone: 'neutral' },
  running: { label: 'Виконується', tone: 'info' },
  cancelled: { label: 'Скасовано', tone: 'neutral' },
  failed: { label: 'Помилка', tone: 'danger' },
  completed: { label: 'Завершено', tone: 'success' },
  partial: { label: 'Частково', tone: 'gold' },
  // checks
  pass: { label: 'Пройдено', tone: 'success' },
  warn: { label: 'Увага', tone: 'gold' },
  fail: { label: 'Провал', tone: 'danger' },
  // scripture
  match: { label: 'Збіг', tone: 'success' },
  paraphrase: { label: 'Переказ', tone: 'gold' },
  mismatch: { label: 'Невідповідність', tone: 'danger' },
  not_found: { label: 'Вірша немає', tone: 'danger' },
  // providers
  connected: { label: 'Підключено', tone: 'success' },
  degraded: { label: 'Збої', tone: 'gold' },
  offline: { label: 'Офлайн', tone: 'danger' },
  not_configured: { label: 'Не налаштовано', tone: 'neutral' },
};

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'border-line-strong bg-[color-mix(in_srgb,var(--p-ink)_6%,transparent)] text-muted',
  info: 'border-[color-mix(in_srgb,var(--p-indigo)_42%,transparent)] bg-[color-mix(in_srgb,var(--p-indigo)_16%,transparent)] text-[color-mix(in_srgb,var(--p-indigo)_72%,var(--p-ink))]',
  gold: 'border-[color-mix(in_srgb,var(--p-gold)_40%,transparent)] bg-[color-mix(in_srgb,var(--p-gold)_14%,transparent)] text-gold-ink',
  success:
    'border-[color-mix(in_srgb,var(--p-success)_38%,transparent)] bg-[color-mix(in_srgb,var(--p-success)_14%,transparent)] text-success',
  danger:
    'border-[color-mix(in_srgb,var(--p-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--p-danger)_14%,transparent)] text-danger',
};

const DOT_CLASS: Record<Tone, string> = {
  neutral: 'bg-faint',
  info: 'bg-indigo',
  gold: 'bg-gold',
  success: 'bg-success',
  danger: 'bg-danger',
};

export function Status({ value, className }: { value: string; className?: string }) {
  const meta = STATUS_META[value] ?? { label: value, tone: 'neutral' as Tone };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        TONE_CLASS[meta.tone],
        className,
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          DOT_CLASS[meta.tone],
          value === 'running' && 'studio-pulse',
        )}
      />
      {meta.label}
    </span>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- surface */

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
  flush,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Tables sit flush against the panel edge; forms get padding. */
  flush?: boolean;
}) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[var(--s-radius)] border border-line bg-[var(--s-panel)]',
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="min-w-0">
            {title && <h2 className="truncate text-[13px] font-bold tracking-[-0.01em]">{title}</h2>}
            {subtitle && <p className="truncate text-[12px] text-faint">{subtitle}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn(!flush && 'p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
  );
}

/* ----------------------------------------------------------------- buttons */

type ButtonProps = {
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'quiet' | 'danger';
  size?: 'sm' | 'md';
  /** Reason the action is unavailable — renders it disabled with a tooltip. */
  denied?: string | null;
} & ComponentPropsWithoutRef<'button'>;

export function Button({
  children,
  variant = 'ghost',
  size = 'sm',
  denied,
  className,
  ...rest
}: ButtonProps) {
  const variants = {
    primary:
      'text-white bg-[linear-gradient(135deg,var(--p-indigo),var(--p-violet))] shadow-[0_8px_20px_-12px_var(--p-violet)]',
    ghost: 'border border-line-strong bg-[var(--s-panel-2)] text-ink hover:border-[var(--p-indigo)]',
    quiet: 'text-muted hover:text-ink',
    danger:
      'border border-[color-mix(in_srgb,var(--p-danger)_45%,transparent)] bg-[color-mix(in_srgb,var(--p-danger)_12%,transparent)] text-danger',
  } as const;
  const sizes = { sm: 'h-8 px-3 text-[12.5px]', md: 'h-9 px-4 text-[13px]' } as const;
  return (
    <button
      type="button"
      title={denied ?? rest.title}
      disabled={Boolean(denied) || rest.disabled}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-[var(--s-radius-sm)] font-semibold whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40',
        sizes[size],
        variants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------- atoms */

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('studio-mono text-faint', className)}>{children}</span>;
}

export function KeyVal({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-1.5 last:border-b-0">
      <dt className="shrink-0 text-[12px] text-faint">{k}</dt>
      <dd className="min-w-0 text-right text-[12.5px] font-medium">{v}</dd>
    </div>
  );
}

export function Metric({
  label,
  value,
  delta,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  hint?: string;
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
}) {
  const accent = {
    good: 'text-success',
    warn: 'text-gold-ink',
    bad: 'text-danger',
    neutral: 'text-muted',
  }[tone];
  return (
    <div
      className="rounded-[var(--s-radius)] border border-line bg-[var(--s-panel)] p-3"
      title={hint}
    >
      <p className="text-[11.5px] font-semibold tracking-[0.02em] text-faint uppercase">{label}</p>
      <p className="studio-num mt-1 font-display text-[24px] leading-none font-semibold">{value}</p>
      {delta && <p className={cn('mt-1.5 text-[12px] font-medium', accent)}>{delta}</p>}
    </div>
  );
}

/**
 * Budget usage. Deliberately not a progress bar for work done — the spec bans
 * invented percentages, and a budget really is a known fraction of a known cap.
 */
export function Bar({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const share = max > 0 ? Math.min(value / max, 1) : 0;
  const tone =
    share >= 1 ? 'var(--p-danger)' : share > 0.8 ? 'var(--p-gold)' : 'var(--p-indigo)';
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-line-strong', className)}>
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${share * 100}%`, background: tone }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center px-6 py-14 text-center">
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-full border border-line bg-[var(--s-panel-2)] text-faint">
        {icon}
      </div>
      <p className="font-display text-[16px] font-semibold">{title}</p>
      <p className="mt-1 max-w-[46ch] text-[13px] text-faint">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Avatar({ initials, title }: { initials: string; title?: string }) {
  return (
    <span
      title={title}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line-strong bg-[linear-gradient(135deg,var(--p-indigo),var(--p-violet))] text-[11px] font-bold text-white"
    >
      {initials}
    </span>
  );
}

/* ------------------------------------------------------------------- table */

export function Grid({
  cols,
  children,
  className,
  head,
  active,
  onClick,
}: {
  cols: string;
  children: ReactNode;
  className?: string;
  head?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      data-active={active ? 'true' : undefined}
      className={cn(
        'grid items-center gap-3 border-b border-line px-4',
        head
          ? 'sticky top-0 z-10 bg-[var(--s-panel)] py-2 text-[11px] font-semibold tracking-[0.04em] text-faint uppercase'
          : 'studio-row py-2.5 text-[13px]',
        onClick && 'cursor-pointer',
        className,
      )}
      style={{ gridTemplateColumns: cols }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ inputs */

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-[11.5px] font-semibold tracking-[0.02em] text-faint uppercase">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-faint">{hint}</span>}
    </label>
  );
}

const CONTROL =
  'h-9 w-full rounded-[var(--s-radius-sm)] border border-line-strong bg-[var(--s-panel-2)] px-3 text-[13px] text-ink';

export function Input(props: ComponentPropsWithoutRef<'input'>) {
  return <input {...props} className={cn(CONTROL, props.className)} />;
}

export function Select({
  options,
  ...rest
}: { options: Array<{ value: string; label: string }> } & ComponentPropsWithoutRef<'select'>) {
  return (
    <select {...rest} className={cn(CONTROL, 'cursor-pointer', rest.className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Chip({
  children,
  active,
  onClick,
  count,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors',
        active
          ? 'border-[color-mix(in_srgb,var(--p-indigo)_55%,transparent)] bg-[color-mix(in_srgb,var(--p-indigo)_18%,transparent)] text-ink'
          : 'border-line bg-[var(--s-panel-2)] text-muted hover:text-ink',
      )}
    >
      {children}
      {count !== undefined && <span className="studio-num text-faint">{count}</span>}
    </button>
  );
}

/* -------------------------------------------------------------------- page */

export function Page({
  title,
  subtitle,
  actions,
  children,
  wide,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Data-heavy screens use the full width; forms and readers stay narrow. */
  wide?: boolean;
}) {
  return (
    <div className={cn('mx-auto px-6 py-5', wide ? 'max-w-[1560px]' : 'max-w-[1180px]')}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[22px] leading-tight font-semibold tracking-[-0.01em]">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-[13px] text-faint">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
