import {
  useCallback,
  useEffect,
  useState,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import {
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  Compass,
  Cpu,
  FolderTree,
  LayoutDashboard,
  type LucideIcon,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Rocket,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import './studio.css';
import { cn } from '../ui/cn';
import { StudioStoreProvider } from './lib/studioStore';
import { useStudio } from './lib/useStudio';
import { DESKTOP_QUERY, useMediaQuery } from './lib/useMediaQuery';
import { CURRENT_USER, DRAFTS, JOBS, ROLE_LABEL } from './lib/mock';
import type { ThemePref } from './lib/studioContext';
import type { Role } from './lib/types';
import { Avatar, Badge, Button, Menu, type MenuOption } from './ui/kit';

import { Overview } from './screens/Overview';
import { Review } from './screens/Review';
import { ReviewItem } from './screens/ReviewItem';
import { Jobs } from './screens/Jobs';
import { JobDetail } from './screens/JobDetail';
import { NewJob } from './screens/NewJob';
import { Library } from './screens/Library';
import { Releases } from './screens/Releases';
import { Settings } from './screens/Settings';
import { Guide } from './screens/Guide';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  live?: boolean;
}

/**
 * Seven entries, not thirteen. Quality lives inside the library, the audit log
 * inside releases, Scripture inside the review queue — each of them is a second
 * view of the same subject, not a separate place to remember.
 */
const NAV: NavItem[] = [
  { to: '', label: 'Огляд', icon: LayoutDashboard },
  {
    to: 'review',
    label: 'Черга',
    icon: BadgeCheck,
    badge: DRAFTS.filter((d) => d.status === 'ready_for_review').length,
  },
  {
    to: 'jobs',
    label: 'Робота AI',
    icon: Cpu,
    badge: JOBS.filter((j) => j.status === 'running' || j.status === 'queued').length,
    live: JOBS.some((j) => j.status === 'running'),
  },
  { to: 'library', label: 'Бібліотека', icon: FolderTree },
  { to: 'releases', label: 'Випуск', icon: Rocket },
];

const NAV_FOOT: NavItem[] = [
  { to: 'guide', label: 'Як це працює', icon: Compass },
  { to: 'settings', label: 'Налаштування', icon: SettingsIcon },
];

const ROLES: Role[] = ['author', 'reviewer', 'admin'];

/** Where a rail tooltip should appear — the vertical centre of the hovered row. */
interface Tip {
  label: string;
  y: number;
}

type ShowTip = (tip: Tip | null) => void;

function tipHandlers(label: string, rail: boolean, showTip: ShowTip) {
  if (!rail) return {};
  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    showTip({ label, y: r.top + r.height / 2 });
  };
  return {
    onMouseEnter: (e: ReactMouseEvent<HTMLElement>) => show(e.currentTarget),
    onFocus: (e: ReactFocusEvent<HTMLElement>) => show(e.currentTarget),
    onMouseLeave: () => showTip(null),
    onBlur: () => showTip(null),
  };
}

function NavRow({ item, rail, showTip }: { item: NavItem; rail: boolean; showTip: ShowTip }) {
  const { to, label, icon: Icon, badge, live } = item;
  const hasBadge = badge !== undefined && badge > 0;
  return (
    <NavLink
      to={to}
      end={to === ''}
      aria-label={rail ? (hasBadge ? `${label}: ${badge}` : label) : undefined}
      {...tipHandlers(hasBadge ? `${label} · ${badge}` : label, rail, showTip)}
      className={({ isActive }) =>
        cn(
          'relative mb-0.5 flex h-9 items-center gap-2.5 rounded-[var(--s-radius-sm)] text-[13.5px] font-medium transition-colors',
          rail ? 'w-10 justify-center' : 'px-2.5',
          isActive
            ? 'bg-[color-mix(in_srgb,var(--p-indigo)_18%,transparent)] text-ink'
            : 'text-muted hover:bg-[var(--s-hover)] hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={16}
            strokeWidth={isActive ? 2.2 : 1.8}
            className={cn('shrink-0', isActive && 'text-indigo')}
          />
          {!rail && <span className="flex-1 truncate">{label}</span>}
          {hasBadge &&
            (rail ? (
              /* On the rail the count shrinks to a dot: the number is in the
                 tooltip, the dot only says "something is waiting here". */
              <span
                aria-hidden
                className={cn(
                  'absolute top-1.5 right-1.5 h-2 w-2 rounded-full ring-2 ring-[var(--s-chrome)]',
                  live ? 'bg-[var(--p-indigo)]' : 'bg-[var(--p-gold)]',
                )}
              />
            ) : (
              <span
                className={cn(
                  'studio-num rounded-full px-1.5 py-px text-[11px] font-bold',
                  live
                    ? 'bg-[color-mix(in_srgb,var(--p-indigo)_30%,transparent)] text-ink'
                    : 'bg-[color-mix(in_srgb,var(--p-gold)_20%,transparent)] text-gold-ink',
                )}
              >
                {badge}
              </span>
            ))}
        </>
      )}
    </NavLink>
  );
}

/**
 * Desktop (≥1024px): the sidebar sits in the layout and folds to a 56px rail;
 * the choice is remembered. Tablet: the rail is permanent and the full menu
 * opens over the content, closing again on navigation — there is no width to
 * spare for it to stay open.
 */
function Sidebar({
  rail,
  overlay,
  onToggle,
}: {
  rail: boolean;
  overlay: boolean;
  onToggle: () => void;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  /* The tooltip is portalled to the studio root: inside the sidebar it would
     share the sidebar's layer and paint under the content column next to it. */
  const [root, setRoot] = useState<HTMLElement | null>(null);

  const toggleLabel = rail ? 'Розгорнути меню' : 'Згорнути меню';

  return (
    <aside
      ref={(el) => setRoot((el?.closest('.studio-root') as HTMLElement | null) ?? null)}
      className="studio-sidebar relative z-10 flex shrink-0 flex-col overflow-hidden border-r border-line bg-[var(--s-chrome)]"
      data-rail={rail}
      data-overlay={overlay}
      aria-label="Розділи студії"
      /* A click changes the layout under the pointer, so the hover that set a
         tooltip may never get its matching leave. */
      onClickCapture={() => setTip(null)}
    >
      <div
        className={cn(
          'flex h-14 shrink-0 items-center gap-2.5 border-b border-line',
          rail ? 'justify-center' : 'px-4',
        )}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] bg-[linear-gradient(135deg,var(--p-indigo),var(--p-violet))]">
          <Sparkles size={15} className="text-white" />
        </span>
        {!rail && <p className="flex-1 truncate font-display text-[14px] font-semibold">Студія</p>}
        {overlay && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Закрити меню"
            className="grid h-7 w-7 place-items-center rounded-full text-faint hover:text-ink"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <nav
        className={cn(
          'studio-scroll flex-1 overflow-x-hidden overflow-y-auto py-3',
          rail ? 'flex flex-col items-center px-2' : 'px-2',
        )}
        onScroll={() => setTip(null)}
      >
        {NAV.map((item) => (
          <NavRow key={item.to || 'overview'} item={item} rail={rail} showTip={setTip} />
        ))}
      </nav>

      <nav
        className={cn(
          'shrink-0 border-t border-line py-2',
          rail ? 'flex flex-col items-center px-2' : 'px-2',
        )}
      >
        {NAV_FOOT.map((item) => (
          <NavRow key={item.to} item={item} rail={rail} showTip={setTip} />
        ))}

        {/* The fold control lives at the foot, in the same place in both
            states — it never moves under the pointer that just clicked it. */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!rail}
          aria-label={rail ? toggleLabel : undefined}
          aria-keyshortcuts="["
          {...tipHandlers(`${toggleLabel} · [`, rail, setTip)}
          className={cn(
            'mt-1 flex h-9 items-center gap-2.5 rounded-[var(--s-radius-sm)] text-[13px] text-faint transition-colors hover:bg-[var(--s-hover)] hover:text-ink',
            rail ? 'w-10 justify-center' : 'w-full px-2.5',
          )}
        >
          {rail ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {!rail && (
            <>
              <span className="flex-1 text-left">{toggleLabel}</span>
              <kbd className="studio-mono rounded border border-line px-1 text-[11px] text-faint">[</kbd>
            </>
          )}
        </button>
      </nav>

      {/* A tooltip must not outlive the rail it belongs to. */}
      {rail &&
        tip &&
        root &&
        createPortal(
          <span className="studio-tip" style={{ top: tip.y }} role="tooltip">
            {tip.label}
          </span>,
          root,
        )}
    </aside>
  );
}

const CRUMBS: Record<string, string> = {
  review: 'Черга',
  jobs: 'Робота AI',
  new: 'Новий запуск',
  library: 'Бібліотека',
  releases: 'Випуск',
  settings: 'Налаштування',
  guide: 'Як це працює',
};

const THEME_ICON: Record<ThemePref, LucideIcon> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

function ThemeMenu() {
  const { themePref, setThemePref, theme } = useStudio();
  const Icon = THEME_ICON[themePref];

  const options: Array<MenuOption<ThemePref>> = [
    {
      value: 'system',
      label: 'Як у системі',
      icon: Monitor,
      hint: `зараз ${theme === 'dark' ? 'темна' : 'світла'}`,
    },
    { value: 'light', label: 'Світла', icon: Sun },
    { value: 'dark', label: 'Темна', icon: Moon },
  ];

  return (
    <Menu
      label="Тема"
      value={themePref}
      onChange={setThemePref}
      options={options}
      triggerClassName="px-2"
      trigger={
        <>
          <Icon size={15} />
          <ChevronDown size={12} className="text-faint" />
        </>
      }
    />
  );
}

function Topbar({ wide }: { wide: boolean }) {
  const { role, setRole, env, setEnv } = useStudio();
  const { pathname } = useLocation();
  const parts = pathname.replace(/^\/studio\/?/, '').split('/').filter(Boolean);

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-[var(--s-chrome)] px-4 min-[1024px]:px-5">
      <nav className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px]" aria-label="Де я">
        {parts.length === 0 ? (
          <span className="font-semibold">Огляд</span>
        ) : (
          parts.map((part, i) => (
            <span
              key={`${part}-${i}`}
              /* On a narrow bar the parents give way first; the current page
                 keeps its name. */
              className={cn(
                'flex min-w-0 items-center gap-1.5',
                i < parts.length - 1 && 'max-[1023px]:hidden',
              )}
            >
              {i > 0 && <ChevronRight size={13} className="shrink-0 text-faint" />}
              <span
                className={cn('truncate', i === parts.length - 1 ? 'font-semibold' : 'text-faint')}
              >
                {CRUMBS[part] ?? part}
              </span>
            </span>
          ))
        )}
      </nav>

      <div className="flex shrink-0 items-center gap-2">
        {/* Environment is part of the permission story: nothing publishes to
            production from a staging session. */}
        <button
          type="button"
          onClick={() => setEnv(env === 'staging' ? 'production' : 'staging')}
          title="Перемкнути середовище"
        >
          <Badge tone={env === 'production' ? 'danger' : 'neutral'}>{env}</Badge>
        </button>

        <ThemeMenu />

        {/* Three labelled pills fit a desktop bar; on a tablet the same choice
            becomes a menu so the page title keeps its room. */}
        {wide ? (
          <div className="flex items-center gap-1 rounded-full border border-line bg-[var(--s-panel)] p-0.5">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                aria-pressed={role === r}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors',
                  role === r ? 'bg-[var(--s-hover)] text-ink' : 'text-muted hover:text-ink',
                )}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
        ) : (
          <Menu
            label="Переглядати як"
            value={role}
            onChange={setRole}
            options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
            triggerClassName="pr-2.5 pl-3 text-[12px] font-semibold"
            trigger={
              <>
                {ROLE_LABEL[role]}
                <ChevronDown size={12} className="text-faint" />
              </>
            }
          />
        )}

        <Avatar initials={CURRENT_USER.initials} title={`${CURRENT_USER.name} · ${ROLE_LABEL[role]}`} />
      </div>
    </header>
  );
}

/**
 * Reserved surface for the studio copilot. Phase 4 explicitly rules out an
 * open-ended AI chat, so the prototype claims the space and states the contract
 * instead of faking an assistant.
 */
function CopilotDock() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Місце під майбутнього асистента"
        className="fixed right-5 bottom-5 z-30 grid h-9 w-9 place-items-center rounded-full border border-dashed border-line-strong bg-[var(--s-panel)] text-faint transition-colors hover:text-ink"
      >
        <Sparkles size={15} />
      </button>
    );
  }

  return (
    <div className="fixed right-5 bottom-5 z-30 w-[310px] rounded-[var(--s-radius)] border border-dashed border-line-strong bg-[var(--s-panel)] p-4 shadow-[var(--s-shadow)]">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles size={14} className="text-gold" />
        <p className="flex-1 text-[13px] font-bold">Тут буде асистент</p>
        <button type="button" onClick={() => setOpen(false)} className="text-faint hover:text-ink">
          <X size={15} />
        </button>
      </div>
      <p className="text-[12.5px] leading-relaxed text-muted">
        Місце зарезервовано: пояснити помилку, запропонувати правку, зібрати
        запуск із фрази.
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-faint">
        Свідомо не реалізовано: підказка звідси має ставати запуском із явними
        параметрами, який проходить ті самі перевірки й ту саму перевірку людиною.
      </p>
    </div>
  );
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}

/**
 * The studio chrome. Screens render through `Outlet`, so every link in them can
 * stay relative (`review/d-101`, `../jobs`) and keep working if the mount point
 * ever moves off `/proto/studio`.
 */
function StudioLayout() {
  const location = useLocation();
  const { theme, navCollapsed, setNavCollapsed } = useStudio();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const wideBar = useMediaQuery('(min-width: 1180px)');
  /* The tablet overlay remembers the page it was opened on: it is a way to get
     somewhere, so once the path changes it is closed without an effect. */
  const [overlayOn, setOverlayOn] = useState<string | null>(null);
  const overlay = !desktop && overlayOn === location.pathname;
  const rail = desktop ? navCollapsed : !overlay;

  const closeOverlay = useCallback(() => setOverlayOn(null), []);
  const toggle = useCallback(() => {
    if (desktop) setNavCollapsed(!navCollapsed);
    else setOverlayOn(overlay ? null : location.pathname);
  }, [desktop, navCollapsed, setNavCollapsed, overlay, location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && overlay) closeOverlay();
      if (e.key === '[' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [overlay, toggle, closeOverlay]);

  /* Native controls (select, scrollbars, focus rings) follow this, not CSS. */
  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
    return () => {
      document.documentElement.style.colorScheme = '';
    };
  }, [theme]);

  return (
    <div
      className="studio-root proto-root relative flex h-[100dvh] w-full overflow-hidden"
      data-proto-theme={theme}
    >
      <div className="studio-wash" />
      {/* While the tablet menu floats, this holds the rail's place so the
          content underneath does not shift. */}
      {overlay && <div className="w-14 shrink-0" aria-hidden />}
      <Sidebar rail={rail} overlay={overlay} onToggle={toggle} />
      {overlay && <div className="studio-nav-veil" onClick={closeOverlay} />}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <Topbar wide={wideBar} />
        <main
          key={location.pathname}
          className="studio-main studio-scroll relative flex-1 overflow-y-auto overscroll-contain"
        >
          <Outlet />
        </main>
        {/* Same stacking context as the screens, so an open drawer covers the
            dock instead of the dock sitting on the drawer's footer buttons. */}
        <CopilotDock />
      </div>
    </div>
  );
}

/** Phones get an honest note rather than a squeezed data grid. */
function TooNarrow() {
  const { theme } = useStudio();
  return (
    <div
      className="studio-root proto-root grid h-[100dvh] place-items-center px-6"
      data-proto-theme={theme}
    >
      <div className="max-w-[34ch] text-center">
        <p className="font-display text-[18px] font-semibold">Студія — для планшета й комп'ютера</p>
        <p className="mt-2 text-[13px] text-faint">
          Черга, порівняння версій і журнали не стискаються до телефона без
          втрати сенсу. Відкрий на екрані від 768px — або поверни планшет.
        </p>
        <a href="../" className="mt-4 inline-block">
          <Button variant="ghost">← До застосунку</Button>
        </a>
      </div>
    </div>
  );
}

export function StudioApp() {
  return (
    <StudioStoreProvider>
      <div className="hidden min-[768px]:contents">
        <Routes>
          <Route path="/studio" element={<StudioLayout />}>
            <Route index element={<Overview />} />
            <Route path="review" element={<Review />} />
            <Route path="review/:draftId" element={<ReviewItem />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="jobs/new" element={<NewJob />} />
            <Route path="jobs/:jobId" element={<JobDetail />} />
            <Route path="library" element={<Library />} />
            <Route path="releases" element={<Releases />} />
            <Route path="settings" element={<Settings />} />
            <Route path="guide" element={<Guide />} />
            <Route path="*" element={<Navigate to="/studio" replace />} />
          </Route>
        </Routes>
      </div>
      <div className="min-[768px]:hidden">
        <TooNarrow />
      </div>
    </StudioStoreProvider>
  );
}
