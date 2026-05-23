import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { PlayerProvider } from './context/PlayerContext';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Home } from './pages/Home';
import { Themes } from './pages/Themes';
import { ThemeDetail } from './pages/ThemeDetail';
import { Quiz } from './pages/Quiz';
import { StudyHub } from './pages/StudyHub';
import { Profile } from './pages/Profile';
import { GlobalStats } from './pages/GlobalStats';
import { Shop } from './pages/Shop';
import { AdminPanel } from './pages/AdminPanel';
import { MicroTraining } from './pages/MicroTraining';
import { PlayHub } from './pages/play/PlayHub';
import { Millionaire } from './pages/play/Millionaire';
import { Survival } from './pages/play/Survival';
import { KahootHub } from './pages/play/kahoot/KahootHub';
import { KahootCreate } from './pages/play/kahoot/KahootCreate';
import { KahootJoin } from './pages/play/kahoot/KahootJoin';
import { KahootRoom } from './pages/play/kahoot/KahootRoom';
import { KahootPlaylists } from './pages/play/kahoot/KahootPlaylists';
import { KahootPlaylistEditor } from './pages/play/kahoot/KahootPlaylistEditor';
import { KahootPlaylistDetails } from './pages/play/kahoot/KahootPlaylistDetails';
import { Challenges } from './pages/social/Challenges';
import { ChallengeDetails } from './pages/social/ChallengeDetails';
import { Communities } from './pages/social/Communities';
import { CommunityDetails } from './pages/social/CommunityDetails';

function LegacyThemeRedirect() {
  const { themeId } = useParams<{ themeId: string }>();
  return <Navigate to={`/play/study/themes/${themeId}`} replace />;
}

function LegacyQuizRedirect() {
  const { themeId, difficulty } = useParams<{ themeId: string; difficulty: string }>();
  return <Navigate to={`/play/study/quiz/${themeId}/${difficulty}`} replace />;
}

export default function App() {
  return (
    <PlayerProvider>
      <ToastProvider>
      <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<ErrorBoundary><Home /></ErrorBoundary>} />
              <Route path="play" element={<ErrorBoundary><PlayHub /></ErrorBoundary>} />
              <Route path="play/study" element={<ErrorBoundary><StudyHub /></ErrorBoundary>} />
              <Route path="play/study/themes" element={<ErrorBoundary><Themes /></ErrorBoundary>} />
              <Route path="play/study/themes/:themeId" element={<ErrorBoundary><ThemeDetail /></ErrorBoundary>} />
              <Route path="play/study/themes/:themeId/:nodeId" element={<ErrorBoundary><ThemeDetail /></ErrorBoundary>} />
              <Route path="play/study/theme/:themeId" element={<ErrorBoundary><ThemeDetail /></ErrorBoundary>} />
              <Route path="play/study/micro" element={<ErrorBoundary><MicroTraining /></ErrorBoundary>} />
              <Route path="profile" element={<ErrorBoundary><Profile /></ErrorBoundary>} />
              <Route path="admin" element={<ErrorBoundary><AdminPanel /></ErrorBoundary>} />
              <Route path="shop" element={<ErrorBoundary><Shop /></ErrorBoundary>} />
              <Route path="stats" element={<ErrorBoundary><GlobalStats /></ErrorBoundary>} />
              <Route path="social/challenges" element={<ErrorBoundary><Challenges /></ErrorBoundary>} />
              <Route path="social/challenges/:challengeId" element={<ErrorBoundary><ChallengeDetails /></ErrorBoundary>} />
              <Route path="social/communities" element={<ErrorBoundary><Communities /></ErrorBoundary>} />
              <Route path="social/communities/:communityId" element={<ErrorBoundary><CommunityDetails /></ErrorBoundary>} />

              {/* Старі URL → нові */}
              <Route path="themes" element={<Navigate to="/play/study" replace />} />
              <Route path="themes/:themeId" element={<LegacyThemeRedirect />} />
              <Route path="play/solo" element={<Navigate to="/play/study" replace />} />
              <Route path="play/solo/themes/:themeId" element={<LegacyThemeRedirect />} />
            </Route>

            {/* Повноекранні ігрові екрани без нижнього меню */}
            <Route path="play/study/quiz/:themeId/:difficulty" element={<ErrorBoundary><Quiz mode="practice" /></ErrorBoundary>} />
            <Route path="play/study/quiz/:themeId/:difficulty/:nodeId" element={<ErrorBoundary><Quiz mode="practice" /></ErrorBoundary>} />
            <Route path="play/study/review" element={<ErrorBoundary><Quiz mode="review" /></ErrorBoundary>} />
            <Route path="play/study/sprint" element={<ErrorBoundary><Quiz mode="sprint" /></ErrorBoundary>} />
            <Route path="play/study/adaptive/:themeId/:nodeId" element={<ErrorBoundary><Quiz mode="adaptive" /></ErrorBoundary>} />
            <Route path="play/study/adaptive" element={<ErrorBoundary><Quiz mode="adaptive" /></ErrorBoundary>} />
            <Route path="play/study/micro/:themeId/:nodeId" element={<ErrorBoundary><Quiz mode="micro" /></ErrorBoundary>} />
            <Route path="play/study/micro" element={<ErrorBoundary><Quiz mode="micro" /></ErrorBoundary>} />
            <Route path="play/study/millionaire" element={<ErrorBoundary><Millionaire /></ErrorBoundary>} />
            <Route path="play/study/survival" element={<ErrorBoundary><Survival /></ErrorBoundary>} />
            <Route path="play/solo/quiz/:themeId/:difficulty" element={<LegacyQuizRedirect />} />
            <Route path="play/solo/millionaire" element={<Navigate to="/play/study/millionaire" replace />} />
            <Route path="play/solo/survival" element={<Navigate to="/play/study/survival" replace />} />
            <Route path="quiz/:themeId/:difficulty" element={<ErrorBoundary><Quiz mode="practice" /></ErrorBoundary>} />

            <Route path="play/kahoot" element={<ErrorBoundary><KahootHub /></ErrorBoundary>} />
            <Route path="play/kahoot/create" element={<ErrorBoundary><KahootCreate /></ErrorBoundary>} />
            <Route path="play/kahoot/join" element={<ErrorBoundary><KahootJoin /></ErrorBoundary>} />
            <Route path="play/kahoot/playlists" element={<ErrorBoundary><KahootPlaylists /></ErrorBoundary>} />
            <Route path="play/kahoot/playlists/new" element={<ErrorBoundary><KahootPlaylistEditor /></ErrorBoundary>} />
            <Route path="play/kahoot/playlists/:playlistId" element={<ErrorBoundary><KahootPlaylistDetails /></ErrorBoundary>} />
            <Route path="play/kahoot/playlists/:playlistId/edit" element={<ErrorBoundary><KahootPlaylistEditor /></ErrorBoundary>} />
            <Route path="play/kahoot/room/:code" element={<ErrorBoundary><KahootRoom /></ErrorBoundary>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
      </BrowserRouter>
      </ToastProvider>
    </PlayerProvider>
  );
}
