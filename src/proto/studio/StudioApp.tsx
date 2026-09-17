import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import {
  BadgeCheck,
  ChevronRight,
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
  X,
} from 'lucide-react';
import './studio.css';
import { cn } from '../ui/cn';
import { StudioStoreProvider } from './lib/studioStore';
import { useStudio } from './lib/useStudio';
import { CURRENT_USER, DRAFTS, JOBS, ROLE_LABEL } from './lib/mock';
import type { ThemePref } from './lib/studioContext';
import type { Role } from './lib/types';
import { Avatar, Badge, Button } from './ui/kit';

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

function NavRow({ item }: { item: NavItem }) {
  const { to, label, icon: Icon, badge, live } = item;
  return (
    <NavLink
      to={to}
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
  return (
    <aside className="relative z-10 flex w-[212px] shrink-0 flex-col border-r border-line bg-[var(--s-chrome)]">
      <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
        <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-[linear-gradient(135deg,var(--p-indigo),var(--p-violet))]">
          <Sparkles size={15} className="text-white" />
        </span>
        <p className="truncate font-display text-[14px] font-semibold">Студія</p>
      </div>

      <nav className="studio-scroll flex-1 overflow-y-auto px-2 py-3">
        {NAV.map((item) => (
          <NavRow key={item.to || 'overview'} item={item} />
        ))}
      </nav>

      <nav className="border-t border-line px-2 py-2">
        {NAV_FOOT.map((item) => (
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
};

const THEME_CYCLE: ThemePref[] = ['system', 'light', 'dark'];
const THEME_META: Record<ThemePref, { icon: LucideIcon; label: string }> = {
  system: { icon: Monitor, label: 'Тема: як у системі' },
  light: { icon: Sun, label: 'Тема: світла' },
  dark: { icon: Moon, label: 'Тема: темна' },
};

function Topbar() {
  const { role, setRole, env, setEnv, themePref, setThemePref } = useStudio();
  const { pathname } = useLocation();
  const parts = pathname.replace(/^\/studio\/?/, '').split('/').filter(Boolean);
  const ThemeIcon = THEME_META[themePref].icon;

  return (
    <header className="relative z-10 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-[var(--s-chrome)] px-5">
      <nav className="flex min-w-0 items-center gap-1.5 text-[13px]">
        {parts.length === 0 ? (
          <span className="font-semibold">Огляд</span>
        ) : (
          parts.map((part, i) => (
            <span key={`${part}-${i}`} className="flex min-w-0 items-center gap-1.5">
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

      <div className="ml-auto flex items-center gap-2">
        {/* Environment is part of the permission story: nothing publishes to
            production from a staging session. */}
        <button
          type="button"
          onClick={() => setEnv(env === 'staging' ? 'production' : 'staging')}
          title="Перемкнути середовище"
        >
          <Badge tone={env === 'production' ? 'danger' : 'neutral'}>{env}</Badge>
        </button>

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

        <div className="flex items-center gap-1 rounded-full border border-line bg-[var(--s-panel)] p-0.5">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors',
                role === r ? 'bg-[var(--s-hover)] text-ink' : 'text-muted hover:text-ink',
              )}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>

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

/**
 * The studio chrome. Screens render through `Outlet`, so every link in them can
 * stay relative (`review/d-101`, `../jobs`) and keep working if the mount point
 * ever moves off `/proto/studio`.
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
    <div
      className="studio-root proto-root flex h-[100dvh] w-full overflow-hidden"
      data-proto-theme={theme}
    >
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
      <CopilotDock />
    </div>
  );
}

/** Narrow viewports get an honest note rather than a squeezed data grid. */
function TooNarrow() {
  const { theme } = useStudio();
  return (
    <div
      className="studio-root proto-root grid h-[100dvh] place-items-center px-6"
      data-proto-theme={theme}
    >
      <div className="max-w-[34ch] text-center">
        <p className="font-display text-[18px] font-semibold">Студія — десктопний інструмент</p>
        <p className="mt-2 text-[13px] text-faint">
          Черга, порівняння версій і журнали не стискаються до телефона без
          втрати сенсу. Відкрий на екрані від 1100px.
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
      <div className="hidden min-[1100px]:contents">
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
      <div className="min-[1100px]:hidden">
        <TooNarrow />
      </div>
    </StudioStoreProvider>
  );
}
