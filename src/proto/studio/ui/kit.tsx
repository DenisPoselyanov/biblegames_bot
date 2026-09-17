import { useEffect, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { ChevronDown, HelpCircle, X } from 'lucide-react';
import { cn } from '../../ui/cn';
import { GLOSSARY } from '../lib/glossary';

/* ------------------------------------------------------------------ status */

type Tone = 'neutral' | 'info' | 'gold' | 'success' | 'danger';

/**
 * One vocabulary for every state the studio shows — draft lifecycle, job
 * lifecycle, check severity, Scripture verdict, provider health. Same word in
 * two places always gets the same colour, so a red dot never needs a legend.
 *
 * Labels are plain Ukrainian, not the internal enum: the enum is visible in the
 * `?` explanation and in ids, where it belongs.
 */
const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  // draft lifecycle
  draft: { label: 'Чернетка', tone: 'neutral' },
  generated: { label: 'Згенеровано', tone: 'info' },
  validation_failed: { label: 'Є помилка', tone: 'danger' },
  ready_for_review: { label: 'Чекає перевірки', tone: 'gold' },
  changes_requested: { label: 'На доопрацюванні', tone: 'gold' },
  approved: { label: 'Схвалено', tone: 'success' },
  scheduled: { label: 'Заплановано', tone: 'info' },
  published: { label: 'У грі', tone: 'success' },
  superseded: { label: 'Замінено', tone: 'neutral' },
  archived: { label: 'В архіві', tone: 'neutral' },
  rolled_back: { label: 'Відкочено', tone: 'danger' },
  // jobs
  queued: { label: 'У черзі', tone: 'neutral' },
  running: { label: 'Працює', tone: 'info' },
  cancelled: { label: 'Скасовано', tone: 'neutral' },
  failed: { label: 'Помилка', tone: 'danger' },
  completed: { label: 'Готово', tone: 'success' },
  partial: { label: 'Частково', tone: 'gold' },
  // checks
  pass: { label: 'Гаразд', tone: 'success' },
  warn: { label: 'Увага', tone: 'gold' },
  fail: { label: 'Помилка', tone: 'danger' },
  // scripture
  match: { label: 'Збіг', tone: 'success' },
  paraphrase: { label: 'Переказ', tone: 'gold' },
  mismatch: { label: 'Не той текст', tone: 'danger' },
  not_found: { label: 'Вірша немає', tone: 'danger' },
  // providers
  connected: { label: 'Працює', tone: 'success' },
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

/* ---------------------------------------------------------------- glossary */

/**
 * A word plus a `?` that explains it where it stands. The studio may use a term
 * like «checkpoint» only with this next to it — the alternative is a newcomer
 * guessing, or a glossary nobody opens.
 */
export function Term({
  k,
  children,
  align = 'start',
  iconOnly,
  className,
}: {
  k: keyof typeof GLOSSARY;
  children?: ReactNode;
  align?: 'start' | 'end';
  /** Just the `?`, for labels that already say the word. */
  iconOnly?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLSpanElement>(null);
  const entry = GLOSSARY[k];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!host.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={host} className={cn('relative inline-flex items-center gap-1', className)}>
      {!iconOnly && <span>{children ?? entry.term}</span>}
      <button
        type="button"
        aria-label={`Що таке «${entry.term}»`}
        aria-expanded={open}
        onClick={(e) => {
          /* The `?` frequently sits inside a <label> or next to a toggle — it
             must never activate whatever it is standing in. */
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          'grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors',
          open
            ? 'border-indigo text-indigo'
            : 'border-line-strong text-faint hover:border-[var(--p-indigo)] hover:text-indigo',
        )}
      >
        <HelpCircle size={11} strokeWidth={2.2} />
      </button>
      {open && (
        <span className="studio-pop" data-align={align}>
          <span className="block font-display text-[14px] font-semibold">{entry.term}</span>
          <span className="mt-1 block text-[12.5px] leading-relaxed text-muted">{entry.short}</span>
          {entry.more && (
            <span className="mt-2 block border-t border-line pt-2 text-[12px] leading-relaxed text-faint">
              {entry.more}
            </span>
          )}
        </span>
      )}
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
            {title && (
              <h2 className="flex items-center gap-1.5 truncate text-[13px] font-bold tracking-[-0.01em]">
                {title}
              </h2>
            )}
            {subtitle && <p className="truncate text-[12px] text-faint">{subtitle}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn(!flush && 'p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/**
 * Everything that is not needed to make the next decision goes in here. The
 * label says what is inside, so opening it is a choice, not a lottery.
 */
export function Disclosure({
  label,
  hint,
  help,
  children,
  defaultOpen,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  /** A `<Term iconOnly>`; rendered beside the toggle, never inside it. */
  help?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <section
      className={cn(
        'overflow-hidden rounded-[var(--s-radius)] border border-line bg-[var(--s-panel)]',
        className,
      )}
    >
      <div className="studio-row flex items-center gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <ChevronDown
            size={15}
            className={cn('shrink-0 text-faint transition-transform', open && 'rotate-180')}
          />
          <span className="text-[13px] font-bold">{label}</span>
          {hint && <span className="ml-auto pl-3 text-[12px] font-normal text-faint">{hint}</span>}
        </button>
        {help}
      </div>
      {open && <div className="border-t border-line">{children}</div>}
    </section>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>;
}

/** A short explanation that belongs to the screen rather than to one control. */
export function Note({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'danger';
  className?: string;
}) {
  return (
    <p
      className={cn(
        'rounded-[var(--s-radius)] border border-dashed px-4 py-3 text-[12.5px] leading-relaxed',
        tone === 'danger'
          ? 'border-[color-mix(in_srgb,var(--p-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--p-danger)_8%,transparent)] text-muted'
          : 'border-line-strong text-faint',
        className,
      )}
    >
      {children}
    </p>
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
      <dt className="flex shrink-0 items-center gap-1 text-[12px] text-faint">{k}</dt>
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
  label: ReactNode;
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
    <div className="rounded-[var(--s-radius)] border border-line bg-[var(--s-panel)] p-3" title={hint}>
      <p className="flex items-center gap-1 text-[11.5px] font-semibold tracking-[0.02em] text-faint uppercase">
        {label}
      </p>
      <p className="studio-num mt-1 font-display text-[24px] leading-none font-semibold">{value}</p>
      {delta && <p className={cn('mt-1.5 text-[12px] font-medium', accent)}>{delta}</p>}
    </div>
  );
}

/**
 * Budget usage. Deliberately not a progress bar for work done — the spec bans
 * invented percentages, and a budget really is a known fraction of a known cap.
 */
export function Bar({ value, max, className }: { value: number; max: number; className?: string }) {
  const share = max > 0 ? Math.min(value / max, 1) : 0;
  const tone = share >= 1 ? 'var(--p-danger)' : share > 0.8 ? 'var(--p-gold)' : 'var(--p-indigo)';
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
  label: ReactNode;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 flex items-center gap-1 text-[11.5px] font-semibold tracking-[0.02em] text-faint uppercase">
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

/** Two or three views of the same subject — never used for unrelated screens. */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (value: T) => void;
  items: Array<{ value: T; label: string; count?: number }>;
}) {
  return (
    <div className="inline-flex gap-1 rounded-full border border-line bg-[var(--s-panel-2)] p-1">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors',
            item.value === value
              ? 'bg-[var(--s-panel)] text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
              : 'text-faint hover:text-muted',
          )}
        >
          {item.label}
          {item.count !== undefined && <span className="studio-num text-faint">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------- level two: drawer */

/**
 * The middle level: enough to decide without leaving the list. Anything that
 * needs the whole screen lives behind «Відкрити повністю».
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  status,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="studio-overlay" onClick={onClose} />
      <aside className="studio-drawer" role="dialog" aria-modal="true">
        <header className="flex items-start gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[16px] leading-tight font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12px] text-faint">{subtitle}</p>}
          </div>
          {status}
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрити"
            className="shrink-0 text-faint hover:text-ink"
          >
            <X size={16} />
          </button>
        </header>
        <div className="studio-scroll flex-1 overflow-y-auto p-4">{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
            {footer}
          </footer>
        )}
      </aside>
    </>
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
    <div className={cn('mx-auto px-6 py-5', wide ? 'max-w-[1360px]' : 'max-w-[1040px]')}>
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
