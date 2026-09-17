import { motion } from 'framer-motion';
import { BookOpen, Gamepad2, Sparkles, TrendingUp, User } from 'lucide-react';
import { useEffect } from 'react';
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import './proto.css';
import { ProtoStoreProvider } from './lib/store';
import { useProto } from './lib/useProto';
import { cn } from './ui/cn';
import { Today } from './screens/Today';
import { Learn } from './screens/Learn';
import { PlanDetail } from './screens/PlanDetail';
import { LessonReader } from './screens/LessonReader';
import { Practice } from './screens/Practice';
import { PracticeResult } from './screens/PracticeResult';
import { Play } from './screens/Play';
import { Progress } from './screens/Progress';
import { Profile } from './screens/Profile';
import { Millionaire } from './screens/Millionaire';
import { Survival } from './screens/Survival';
import { KahootHub, KahootRoom } from './screens/Kahoot';
import { Social } from './screens/Social';
import { Shop } from './screens/Shop';
import { ModuleDetail } from './screens/ModuleDetail';
import { StudioApp } from './studio/StudioApp';

const BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/proto`;

const TABS = [
  { to: '/', label: 'Сьогодні', icon: Sparkles },
  { to: '/learn', label: 'Навчання', icon: BookOpen },
  { to: '/play', label: 'Грати', icon: Gamepad2 },
  { to: '/progress', label: 'Прогрес', icon: TrendingUp },
  { to: '/profile', label: 'Я', icon: User },
];

/** Routes that take over the whole screen — no tab bar, no distractions. */
const IMMERSIVE = ['/lesson', '/practice', '/play/millionaire', '/play/survival', '/play/kahoot'];

function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 px-4 pb-[max(14px,env(safe-area-inset-bottom))]">
      <div className="flex items-stretch gap-1 rounded-[26px] border border-line bg-[color-mix(in_srgb,var(--p-canvas)_72%,transparent)] p-1.5 backdrop-blur-2xl shadow-lift">
        {TABS.map(({ to, label, icon: Icon }) => {
          const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-1 rounded-[20px] px-1 py-2 text-[10px] font-semibold transition-colors',
                active ? 'text-ink' : 'text-faint',
              )}
            >
              {active && (
                <motion.span
                  layoutId="proto-tab"
                  className="absolute inset-0 rounded-[20px] border border-line bg-surface-2"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <Icon
                size={19}
                strokeWidth={active ? 2.2 : 1.8}
                className={cn('relative', active && 'text-gold-ink')}
              />
              <span className="relative">{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

function Shell() {
  const location = useLocation();
  const { theme } = useProto();
  const immersive = IMMERSIVE.some((path) => location.pathname.startsWith(path));

  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
    return () => {
      document.documentElement.style.colorScheme = '';
    };
  }, [theme]);

  return (
    <div className="proto-root proto-stage" data-proto-theme={theme}>
      <div className="proto-device relative h-[100dvh] w-full overflow-hidden bg-canvas">
        <div className="proto-aurora">
          <span className="proto-aurora-warm" />
        </div>
        <div className="proto-grain" />

        {/* Entry-only transition: a route-level exit animation would have to
            resolve every nested AnimatePresence before the next screen mounts. */}
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            'proto-scroll relative z-10 h-full overflow-y-auto overscroll-contain px-4 pt-[max(18px,env(safe-area-inset-top))]',
            immersive ? 'pb-6' : 'pb-[104px]',
          )}
        >
          <Routes location={location}>
            <Route path="/" element={<Today />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/learn/:planId" element={<PlanDetail />} />
            <Route path="/learn/:planId/:moduleId" element={<ModuleDetail />} />
            <Route path="/lesson" element={<LessonReader />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/practice/result" element={<PracticeResult />} />
            <Route path="/play" element={<Play />} />
            <Route path="/play/millionaire" element={<Millionaire />} />
            <Route path="/play/survival" element={<Survival />} />
            <Route path="/play/kahoot" element={<KahootHub />} />
            <Route path="/play/kahoot/room" element={<KahootRoom />} />
            <Route path="/social" element={<Social />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </motion.main>

        {!immersive && <TabBar />}
      </div>
    </div>
  );
}

/**
 * The Content Studio is a different product on the same design system: a
 * desktop tool, not a mini app. It takes over the whole viewport instead of
 * living inside the phone frame, so it is switched here rather than routed
 * inside `Shell`.
 */
function Root() {
  const { pathname } = useLocation();
  return pathname.startsWith('/studio') ? <StudioApp /> : <Shell />;
}

export default function ProtoApp() {
  return (
    <ProtoStoreProvider>
      <BrowserRouter basename={BASE}>
        <Root />
      </BrowserRouter>
    </ProtoStoreProvider>
  );
}
