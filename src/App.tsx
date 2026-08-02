import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { PlayerProvider } from './context/PlayerContext';
import { VantProvider } from './components/VantProvider';
import { TopicHierarchyProvider } from './context/TopicHierarchyContext';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppSkeleton } from './components/skeletons';
import { useTelegramBackButton } from './hooks/useTelegram';

const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const Themes = lazy(() => import('./pages/Themes').then((m) => ({ default: m.Themes })));
const ThemeDetail = lazy(() =>
  import('./pages/ThemeDetail').then((m) => ({ default: m.ThemeDetail })),
);
const Quiz = lazy(() => import('./pages/Quiz').then((m) => ({ default: m.Quiz })));
const StudyHub = lazy(() => import('./pages/StudyHub').then((m) => ({ default: m.StudyHub })));
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })));
const GlobalStats = lazy(() =>
  import('./pages/GlobalStats').then((m) => ({ default: m.GlobalStats })),
);
const Shop = lazy(() => import('./pages/Shop').then((m) => ({ default: m.Shop })));
const AdminPanel = lazy(() =>
  import('./pages/AdminPanel').then((m) => ({ default: m.AdminPanel })),
);
const PlayHub = lazy(() => import('./pages/play/PlayHub').then((m) => ({ default: m.PlayHub })));
const Millionaire = lazy(() =>
  import('./pages/play/Millionaire').then((m) => ({ default: m.Millionaire })),
);
const Survival = lazy(() =>
  import('./pages/play/Survival').then((m) => ({ default: m.Survival })),
);
const KahootHub = lazy(() =>
  import('./pages/play/kahoot/KahootHub').then((m) => ({ default: m.KahootHub })),
);
const KahootCreate = lazy(() =>
  import('./pages/play/kahoot/KahootCreate').then((m) => ({ default: m.KahootCreate })),
);
const KahootJoin = lazy(() =>
  import('./pages/play/kahoot/KahootJoin').then((m) => ({ default: m.KahootJoin })),
);
const KahootRoom = lazy(() =>
  import('./pages/play/kahoot/KahootRoom').then((m) => ({ default: m.KahootRoom })),
);
const KahootDisplay = lazy(() =>
  import('./pages/play/kahoot/KahootDisplay').then((m) => ({ default: m.KahootDisplay })),
);
const KahootPlaylists = lazy(() =>
  import('./pages/play/kahoot/KahootPlaylists').then((m) => ({ default: m.KahootPlaylists })),
);
const KahootPlaylistEditor = lazy(() =>
  import('./pages/play/kahoot/KahootPlaylistEditor').then((m) => ({
    default: m.KahootPlaylistEditor,
  })),
);
const KahootPlaylistDetails = lazy(() =>
  import('./pages/play/kahoot/KahootPlaylistDetails').then((m) => ({
    default: m.KahootPlaylistDetails,
  })),
);
const Challenges = lazy(() =>
  import('./pages/social/Challenges').then((m) => ({ default: m.Challenges })),
);
const ChallengeDetails = lazy(() =>
  import('./pages/social/ChallengeDetails').then((m) => ({ default: m.ChallengeDetails })),
);
const Communities = lazy(() =>
  import('./pages/social/Communities').then((m) => ({ default: m.Communities })),
);
const CommunityDetails = lazy(() =>
  import('./pages/social/CommunityDetails').then((m) => ({ default: m.CommunityDetails })),
);

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<AppSkeleton />}>{children}</Suspense>;
}

function LegacyThemeRedirect() {
  const { themeId } = useParams<{ themeId: string }>();
  return <Navigate to={`/play/study/themes/${themeId}`} replace />;
}

function LegacyQuizRedirect() {
  const { themeId, difficulty } = useParams<{ themeId: string; difficulty: string }>();
  return <Navigate to={`/play/study/quiz/${themeId}/${difficulty}`} replace />;
}

function TelegramBackButtonSync() {
  useTelegramBackButton();
  return null;
}

export default function App() {
  return (
    <PlayerProvider>
      <VantProvider>
      <TopicHierarchyProvider>
      <ToastProvider>
      <BrowserRouter
        basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}
      >
          <TelegramBackButtonSync />
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<ErrorBoundary><LazyPage><Home /></LazyPage></ErrorBoundary>} />
              <Route path="play" element={<ErrorBoundary><LazyPage><PlayHub /></LazyPage></ErrorBoundary>} />
              <Route path="play/study" element={<ErrorBoundary><LazyPage><StudyHub /></LazyPage></ErrorBoundary>} />
              <Route path="play/study/themes" element={<ErrorBoundary><LazyPage><Themes /></LazyPage></ErrorBoundary>} />
              <Route path="play/study/themes/:themeId" element={<ErrorBoundary><LazyPage><ThemeDetail /></LazyPage></ErrorBoundary>} />
              <Route path="play/study/themes/:themeId/:nodeId" element={<ErrorBoundary><LazyPage><ThemeDetail /></LazyPage></ErrorBoundary>} />
              <Route path="play/study/theme/:themeId" element={<ErrorBoundary><LazyPage><ThemeDetail /></LazyPage></ErrorBoundary>} />
              <Route path="profile" element={<ErrorBoundary><LazyPage><Profile /></LazyPage></ErrorBoundary>} />
              <Route path="admin" element={<ErrorBoundary><LazyPage><AdminPanel /></LazyPage></ErrorBoundary>} />
              <Route path="shop" element={<ErrorBoundary><LazyPage><Shop /></LazyPage></ErrorBoundary>} />
              <Route path="stats" element={<ErrorBoundary><LazyPage><GlobalStats /></LazyPage></ErrorBoundary>} />
              <Route path="social/challenges" element={<ErrorBoundary><LazyPage><Challenges /></LazyPage></ErrorBoundary>} />
              <Route path="social/challenges/:challengeId" element={<ErrorBoundary><LazyPage><ChallengeDetails /></LazyPage></ErrorBoundary>} />
              <Route path="social/communities" element={<ErrorBoundary><LazyPage><Communities /></LazyPage></ErrorBoundary>} />
              <Route path="social/communities/:communityId" element={<ErrorBoundary><LazyPage><CommunityDetails /></LazyPage></ErrorBoundary>} />

              <Route path="themes" element={<Navigate to="/play/study" replace />} />
              <Route path="themes/:themeId" element={<LegacyThemeRedirect />} />
              <Route path="play/solo" element={<Navigate to="/play/study" replace />} />
              <Route path="play/solo/themes/:themeId" element={<LegacyThemeRedirect />} />
            </Route>

            <Route path="play/study/quiz/:themeId/:difficulty/stage/:stageIndex" element={<ErrorBoundary><LazyPage><Quiz mode="practice" /></LazyPage></ErrorBoundary>} />
            <Route path="play/study/quiz/:themeId/:difficulty/stage/:stageIndex/:nodeId" element={<ErrorBoundary><LazyPage><Quiz mode="practice" /></LazyPage></ErrorBoundary>} />
            <Route path="play/study/quiz/:themeId/:difficulty" element={<ErrorBoundary><LazyPage><Quiz mode="practice" /></LazyPage></ErrorBoundary>} />
            <Route path="play/study/quiz/:themeId/:difficulty/:nodeId" element={<ErrorBoundary><LazyPage><Quiz mode="practice" /></LazyPage></ErrorBoundary>} />
            <Route path="play/study/review" element={<ErrorBoundary><LazyPage><Quiz mode="review" /></LazyPage></ErrorBoundary>} />
            <Route path="play/study/sprint" element={<Navigate to="/play/study" replace />} />
            <Route path="play/study/adaptive/:themeId/:nodeId" element={<Navigate to="/play/study" replace />} />
            <Route path="play/study/adaptive" element={<Navigate to="/play/study" replace />} />
            <Route path="play/study/micro/:themeId/:nodeId" element={<Navigate to="/play/study" replace />} />
            <Route path="play/study/micro" element={<Navigate to="/play/study" replace />} />
            <Route path="play/study/millionaire" element={<ErrorBoundary><LazyPage><Millionaire /></LazyPage></ErrorBoundary>} />
            <Route path="play/study/survival" element={<ErrorBoundary><LazyPage><Survival /></LazyPage></ErrorBoundary>} />
            <Route path="play/solo/quiz/:themeId/:difficulty" element={<LegacyQuizRedirect />} />
            <Route path="play/solo/millionaire" element={<Navigate to="/play/study/millionaire" replace />} />
            <Route path="play/solo/survival" element={<Navigate to="/play/study/survival" replace />} />
            <Route path="quiz/:themeId/:difficulty" element={<ErrorBoundary><LazyPage><Quiz mode="practice" /></LazyPage></ErrorBoundary>} />

            <Route path="play/kahoot" element={<ErrorBoundary><LazyPage><KahootHub /></LazyPage></ErrorBoundary>} />
            <Route path="play/kahoot/create" element={<ErrorBoundary><LazyPage><KahootCreate /></LazyPage></ErrorBoundary>} />
            <Route path="play/kahoot/join" element={<ErrorBoundary><LazyPage><KahootJoin /></LazyPage></ErrorBoundary>} />
            <Route path="play/kahoot/playlists" element={<ErrorBoundary><LazyPage><KahootPlaylists /></LazyPage></ErrorBoundary>} />
            <Route path="play/kahoot/playlists/new" element={<ErrorBoundary><LazyPage><KahootPlaylistEditor /></LazyPage></ErrorBoundary>} />
            <Route path="play/kahoot/playlists/:playlistId" element={<ErrorBoundary><LazyPage><KahootPlaylistDetails /></LazyPage></ErrorBoundary>} />
            <Route path="play/kahoot/playlists/:playlistId/edit" element={<ErrorBoundary><LazyPage><KahootPlaylistEditor /></LazyPage></ErrorBoundary>} />
            <Route path="play/kahoot/room/:code" element={<ErrorBoundary><LazyPage><KahootRoom /></LazyPage></ErrorBoundary>} />
            <Route path="play/kahoot/display/:code" element={<ErrorBoundary><LazyPage><KahootDisplay /></LazyPage></ErrorBoundary>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
      </BrowserRouter>
      </ToastProvider>
      </TopicHierarchyProvider>
      </VantProvider>
    </PlayerProvider>
  );
}
