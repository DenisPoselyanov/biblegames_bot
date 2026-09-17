import { useState } from 'react';
import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import {
  BadgeCheck,
  BarChart3,
  BookMarked,
  ChevronRight,
  Cpu,
  FolderTree,
  LayoutDashboard,
  type LucideIcon,
  Rocket,
  ScrollText,
  Settings as SettingsIcon,
  Sparkles,
  X,
} from 'lucide-react';
import './studio.css';
import { cn } from '../ui/cn';
import { StudioStoreProvider } from './lib/studioStore';
import { useStudio } from './lib/useStudio';
import { CURRENT_USER, DRAFTS, JOBS, ROLE_LABEL } from './lib/mock';
import type { Role } from './lib/types';
import { Avatar, Badge, Button } from './ui/kit';

import { Overview } from './screens/Overview';
import { ReviewQueue } from './screens/ReviewQueue';
import { ReviewItem } from './screens/ReviewItem';
import { Jobs } from './screens/Jobs';
import { JobDetail } from './screens/JobDetail';
import { NewJob } from './screens/NewJob';
import { Library } from './screens/Library';
import { TopicDetail } from './screens/TopicDetail';
import { Scripture } from './screens/Scripture';
import { Quality } from './screens/Quality';
import { Releases } from './screens/Releases';
import { Audit } from './screens/Audit';
import { Settings } from './screens/Settings';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  live?: boolean;
}

const NAV: Array<{ group: string; items: NavItem[] }> = [
  {
    group: 'Робота',
    items: [
      { to: '', label: 'Огляд', icon: LayoutDashboard },
      {
        to: 'review',
        label: 'Черга ревʼю',
        icon: BadgeCheck,
        badge: DRAFTS.filter((d) => d.status === 'ready_for_review').length,
      },
      {
        to: 'jobs',
        label: 'AI-джоби',
        icon: Cpu,
        badge: JOBS.filter((j) => j.status === 'running' || j.status === 'queued').length,
        live: JOBS.some((j) => j.status === 'running'),
      },
    ],
  },
  {
    group: 'Контент',
    items: [
      { to: 'library', label: 'Бібліотека', icon: FolderTree },
      { to: 'scripture', label: 'Перевірка Писання', icon: BookMarked },
      { to: 'quality', label: 'Якість', icon: BarChart3 },
    ],
  },
  {
    group: 'Випуск',
    items: [
      { to: 'releases', label: 'Релізи', icon: Rocket },
      { to: 'audit', label: 'Аудит', icon: ScrollText },
    ],
  },
  {
    group: 'Система',
    items: [{ to: 'settings', label: 'Налаштування', icon: SettingsIcon }],
  },
];

const ROLES: Role[] = ['author', 'reviewer', 'admin'];

function Sidebar() {
  return (
    <aside className="relative z-10 flex w-[228px] shrink-0 flex-col border-r border-line bg-[var(--s-panel-2)]">
      <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
        <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-[linear-gradient(135deg,var(--p-indigo),var(--p-violet))]">
          <Sparkles size={15} className="text-white" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-[14px] font-semibold">Content Studio</p>
          <p className="truncate text-[11px] text-faint">Bible Games · Phase 4</p>
        </div>
      </div>

      <nav className="studio-scroll flex-1 overflow-y-auto px-2 py-3">
        {NAV.map(({ group, items }) => (
          <div key={group} className="mb-4 last:mb-0">
            <p className="px-2 pb-1.5 text-[10.5px] font-bold tracking-[0.08em] text-faint uppercase">
              {group}
            </p>
            {items.map(({ to, label, icon: Icon, badge, live }) => (
              <NavLink
                key={to || 'overview'}
                to={to}
                end={to === ''}
                className={({ isActive }) =>
                  cn(
                    'mb-0.5 flex h-8 items-center gap-2.5 rounded-[var(--s-radius-sm)] px-2 text-[13px] font-medium transition-colors',
                    isActive
                      ? 'bg-[color-mix(in_srgb,var(--p-indigo)_18%,transparent)] text-ink'
                      : 'text-muted hover:bg-[var(--s-hover)] hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={15}
                      strokeWidth={isActive ? 2.2 : 1.8}
                      className={isActive ? 'text-indigo' : ''}
                    />
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
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-3 py-2.5 text-[11.5px] text-faint">
        Студія не входить у користувацький bundle і живе за RBAC.
      </div>
    </aside>
  );
}

const CRUMBS: Record<string, string> = {
  '': 'Огляд',
  review: 'Черга ревʼю',
  jobs: 'AI-джоби',
  new: 'Новий джоб',
  library: 'Бібліотека',
  scripture: 'Перевірка Писання',
  quality: 'Якість',
  releases: 'Релізи',
  audit: 'Аудит',
  settings: 'Налаштування',
};

function Topbar() {
  const { role, setRole, env, setEnv } = useStudio();
  const { pathname } = useLocation();
  const parts = pathname.replace(/^\/studio\/?/, '').split('/').filter(Boolean);

  return (
    <header className="relative z-10 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-[var(--s-panel-2)] px-5">
      <nav className="flex min-w-0 items-center gap-1.5 text-[13px]">
        <span className="text-faint">Студія</span>
        {parts.length === 0 ? (
          <>
            <ChevronRight size={13} className="text-faint" />
            <span className="font-semibold">Огляд</span>
          </>
        ) : (
          parts.map((part, i) => (
            <span key={`${part}-${i}`} className="flex min-w-0 items-center gap-1.5">
              <ChevronRight size={13} className="shrink-0 text-faint" />
              <span
                className={cn(
                  'truncate',
                  i === parts.length - 1 ? 'font-semibold' : 'text-faint',
                )}
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
          <Badge tone={env === 'production' ? 'danger' : 'neutral'}>
            {env === 'production' ? 'production' : 'staging'}
          </Badge>
        </button>

        <div className="flex items-center gap-1 rounded-full border border-line bg-[var(--s-panel)] p-0.5">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors',
                role === r ? 'bg-[var(--s-hover)] text-ink' : 'text-faint hover:text-muted',
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
        className="fixed right-5 bottom-5 z-30 flex h-10 items-center gap-2 rounded-full border border-dashed border-line-strong bg-[var(--s-panel)] px-3.5 text-[12.5px] font-semibold text-muted backdrop-blur-xl transition-colors hover:text-ink"
      >
        <Sparkles size={14} className="text-gold" />
        Копайлот · місце зарезервовано
      </button>
    );
  }

  return (
    <div className="fixed right-5 bottom-5 z-30 w-[320px] rounded-[var(--s-radius)] border border-dashed border-line-strong bg-[var(--s-panel)] p-4 backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles size={14} className="text-gold" />
        <p className="flex-1 text-[13px] font-bold">Копайлот студії</p>
        <button type="button" onClick={() => setOpen(false)} className="text-faint hover:text-ink">
          <X size={15} />
        </button>
      </div>
      <p className="text-[12.5px] leading-relaxed text-muted">
        Зона під майбутнього асистента: пояснити помилку валідації, запропонувати
        правку формулювання, зібрати джоб із фрази.
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-faint">
        Не реалізується в цьому прототипі свідомо — Phase 4 забороняє відкритий
        AI-чат і auto-approve. Будь-яка підказка звідси має ставати{' '}
        <span className="text-muted">джобом із явними параметрами</span>, який
        проходить ту саму валідацію й ревʼю.
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

  return (
    <div className="studio-root proto-root flex h-[100dvh] w-full overflow-hidden" data-proto-theme="dark">
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
  return (
    <div className="studio-root proto-root grid h-[100dvh] place-items-center px-6" data-proto-theme="dark">
      <div className="max-w-[34ch] text-center">
        <p className="font-display text-[18px] font-semibold">Студія — десктопний інструмент</p>
        <p className="mt-2 text-[13px] text-faint">
          Черга ревʼю, diff і логи джобів не стискаються до телефона без втрати
          сенсу. Відкрий на екрані від 1100px.
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
            <Route path="review" element={<ReviewQueue />} />
            <Route path="review/:draftId" element={<ReviewItem />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="jobs/new" element={<NewJob />} />
            <Route path="jobs/:jobId" element={<JobDetail />} />
            <Route path="library" element={<Library />} />
            <Route path="library/:topicId" element={<TopicDetail />} />
            <Route path="scripture" element={<Scripture />} />
            <Route path="quality" element={<Quality />} />
            <Route path="releases" element={<Releases />} />
            <Route path="audit" element={<Audit />} />
            <Route path="settings" element={<Settings />} />
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
