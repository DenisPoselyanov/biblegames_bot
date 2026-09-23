import { useEffect } from 'react';
import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import {
  BadgeCheck,
  Compass,
  Cpu,
  FolderTree,
  LayoutDashboard,
  type LucideIcon,
  Monitor,
  Moon,
  Rocket,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
} from 'lucide-react';
import { cn } from './ui/cn';
import { useStudio } from './lib/useStudio';
import { useDashboardQuery } from './lib/queries';
import { ROLE_LABEL, type Role } from './lib/rbac';
import type { ThemePref } from './lib/studioContext';
import { Avatar, Badge } from './ui/kit';
import { ComingSoon } from './screens/ComingSoon';
import { Review } from './screens/Review';
import { ReviewItem } from './screens/ReviewItem';
import { Overview } from './screens/Overview';
import { Jobs } from './screens/Jobs';
import { JobDetail } from './screens/JobDetail';
import { NewJob } from './screens/NewJob';
import { Library } from './screens/Library';
import { Releases } from './screens/Releases';
import { Settings } from './screens/Settings';
import { Reports } from './screens/Reports';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  live?: boolean;
}

/**
 * Seven entries, not thirteen (kept from the design prototype). Quality lives
 * inside the library, the audit log inside releases, Scripture inside the
 * review queue — each of them is a second view of the same subject, not a
 * separate place to remember. Review is live since WS8b; Library/Releases/
 * Settings since WS8c; only the Guide is still a placeholder (WS8d).
 */
function useNav(): { primary: NavItem[]; foot: NavItem[] } {
  const dashboard = useDashboardQuery();
  const working = dashboard.data?.jobs
    ? (dashboard.data.jobs.byStatus.pending ?? 0) + (dashboard.data.jobs.byStatus.active ?? 0)
    : 0;

  return {
    primary: [
      { to: '', label: 'Огляд', icon: LayoutDashboard },
      { to: 'review', label: 'Черга', icon: BadgeCheck },
      {
        to: 'jobs',
        label: 'Робота AI',
        icon: Cpu,
        badge: working,
        live: (dashboard.data?.jobs?.byStatus.active ?? 0) > 0,
      },
      { to: 'library', label: 'Бібліотека', icon: FolderTree },
      { to: 'releases', label: 'Випуск', icon: Rocket },
    ],
    foot: [
      { to: 'guide', label: 'Як це працює', icon: Compass },
      { to: 'settings', label: 'Налаштування', icon: SettingsIcon },
    ],
  };
}

function NavRow({ item }: { item: NavItem }) {
  const { to, label, icon: Icon, badge, live } = item;
  return (
    <NavLink
      // Absolute on purpose: the layout route sits under the `studio/*` splat, so
      // a relative `to` resolves against the current URL (react-router v7
      // relative-splat semantics) — from /studio/jobs, `library` became
      // /studio/jobs/library and `''` marked Огляд active on every screen.
      to={to ? `/studio/${to}` : '/studio'}
      end={to === ''}
      className={({ isActive }) =>
        cn(
          'mb-0.5 flex h-9 items-center gap-2.5 rounded-[var(--s-radius-sm)] px-2.5 text-[13.5px] font-medium transition-colors',
          isActive
            ? 'bg-[color-mix(in_srgb,var(--p-indigo)_18%,transparent)] text-ink'
            : 'text-muted hover:bg-[var(--s-hover)] hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} className={isActive ? 'text-indigo' : ''} />
          <span className="flex-1 truncate">{label}</span>
          {badge !== undefined && badge > 0 && (
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
          )}
        </>
      )}
    </NavLink>
  );
}

function Sidebar() {
  const { primary, foot } = useNav();
  return (
    <aside className="relative z-10 flex w-[212px] shrink-0 flex-col border-r border-line bg-[var(--s-chrome)]">
      <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
        <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-[linear-gradient(135deg,var(--p-indigo),var(--p-violet))]">
          <Sparkles size={15} className="text-white" />
        </span>
        <p className="truncate font-display text-[14px] font-semibold">Студія</p>
      </div>

      <nav className="studio-scroll flex-1 overflow-y-auto px-2 py-3">
        {primary.map((item) => (
          <NavRow key={item.to || 'overview'} item={item} />
        ))}
      </nav>

      <nav className="border-t border-line px-2 py-2">
        {foot.map((item) => (
          <NavRow key={item.to} item={item} />
        ))}
      </nav>
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
  question: 'Питання',
  lesson: 'Урок',
};

const THEME_CYCLE: ThemePref[] = ['system', 'light', 'dark'];
const THEME_META: Record<ThemePref, { icon: LucideIcon; label: string }> = {
  system: { icon: Monitor, label: 'Тема: як у системі' },
  light: { icon: Sun, label: 'Тема: світла' },
  dark: { icon: Moon, label: 'Тема: темна' },
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0]?.toUpperCase() ?? '');
}

function Topbar() {
  const { identity, themePref, setThemePref } = useStudio();
  const { pathname } = useLocation();
  const parts = pathname.replace(/^.*\/studio\/?/, '').split('/').filter(Boolean);
  const ThemeIcon = THEME_META[themePref].icon;
  const primaryRole: Role = identity?.roles.includes('admin')
    ? 'admin'
    : identity?.roles.includes('content_publisher')
      ? 'content_publisher'
      : 'content_reviewer';

  return (
    <header className="relative z-10 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-[var(--s-chrome)] px-5">
      <nav className="flex min-w-0 items-center gap-1.5 text-[13px]">
        {parts.length === 0 ? (
          <span className="font-semibold">Огляд</span>
        ) : (
          parts.map((part, i) => (
            <span key={`${part}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <span className="shrink-0 text-faint">/</span>}
              <span
                className={cn('truncate', i === parts.length - 1 ? 'font-semibold' : 'text-faint')}
              >
                {CRUMBS[part] ?? part}
              </span>
            </span>
          ))
        )}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          title={THEME_META[themePref].label}
          aria-label={THEME_META[themePref].label}
          onClick={() =>
            setThemePref(THEME_CYCLE[(THEME_CYCLE.indexOf(themePref) + 1) % THEME_CYCLE.length])
          }
          className="grid h-8 w-8 place-items-center rounded-full border border-line bg-[var(--s-panel)] text-muted transition-colors hover:text-ink"
        >
          <ThemeIcon size={15} />
        </button>

        {identity && (
          <>
            <Badge tone="neutral">{ROLE_LABEL[primaryRole]}</Badge>
            <Avatar initials={initialsOf(identity.displayName)} title={identity.displayName} />
          </>
        )}
      </div>
    </header>
  );
}

/**
 * The studio chrome. Screens render through `Outlet`, so every link in them can
 * stay relative (`review/question/<revisionId>`, `../jobs`).
 */
function StudioLayout() {
  const location = useLocation();
  const { theme } = useStudio();

  /* Native controls (select, scrollbars, focus rings) follow this, not CSS. */
  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
    return () => {
      document.documentElement.style.colorScheme = '';
    };
  }, [theme]);

  return (
    <div className="studio-root proto-root flex h-[100dvh] w-full overflow-hidden" data-proto-theme={theme}>
      <div className="studio-wash" />
      <Sidebar />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main
          key={location.pathname}
          className="studio-scroll relative flex-1 overflow-y-auto overscroll-contain"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Narrow viewports get an honest note rather than a squeezed data grid. */
function TooNarrow() {
  const { theme } = useStudio();
  return (
    <div className="studio-root proto-root grid h-[100dvh] place-items-center px-6" data-proto-theme={theme}>
      <div className="max-w-[34ch] text-center">
        <p className="font-display text-[18px] font-semibold">Студія — десктопний інструмент</p>
        <p className="mt-2 text-[13px] text-faint">
          Черга, порівняння версій і журнали не стискаються до телефона без втрати сенсу. Відкрий
          на екрані від 1100px.
        </p>
      </div>
    </div>
  );
}

export function StudioApp() {
  return (
    <>
      <div className="hidden min-[1100px]:contents">
        <Routes>
          <Route element={<StudioLayout />}>
            <Route index element={<Overview />} />
            <Route path="review" element={<Review />} />
            <Route path="review/reports" element={<Reports />} />
            <Route path="review/:type/:revisionId" element={<ReviewItem />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="jobs/new" element={<NewJob />} />
            <Route path="jobs/:jobId" element={<JobDetail />} />
            <Route path="library" element={<Library />} />
            <Route path="releases" element={<Releases />} />
            <Route path="settings" element={<Settings />} />
            <Route path="guide" element={<ComingSoon title="Як це працює" />} />
            <Route path="*" element={<Navigate to="/studio" replace />} />
          </Route>
        </Routes>
      </div>
      <div className="min-[1100px]:hidden">
        <TooNarrow />
      </div>
    </>
  );
}
