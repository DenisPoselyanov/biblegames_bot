import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { PlayerProvider } from './context/PlayerContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Themes } from './pages/Themes';
import { ThemeDetail } from './pages/ThemeDetail';
import { Quiz } from './pages/Quiz';
import { StudyHub } from './pages/StudyHub';
import { Profile } from './pages/Profile';
import { GlobalStats } from './pages/GlobalStats';
import { Shop } from './pages/Shop';
import { AdminPanel } from './pages/AdminPanel';
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
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="play" element={<PlayHub />} />
            <Route path="play/study" element={<StudyHub />} />
            <Route path="play/study/themes" element={<Themes />} />
            <Route path="play/study/themes/:themeId" element={<ThemeDetail />} />
            <Route path="profile" element={<Profile />} />
            <Route path="admin" element={<AdminPanel />} />
            <Route path="shop" element={<Shop />} />
            <Route path="stats" element={<GlobalStats />} />
            <Route path="social/challenges" element={<Challenges />} />
            <Route path="social/challenges/:challengeId" element={<ChallengeDetails />} />
            <Route path="social/communities" element={<Communities />} />
            <Route path="social/communities/:communityId" element={<CommunityDetails />} />

            {/* Старі URL → нові */}
            <Route path="themes" element={<Navigate to="/play/study" replace />} />
            <Route path="themes/:themeId" element={<LegacyThemeRedirect />} />
            <Route path="play/solo" element={<Navigate to="/play/study" replace />} />
            <Route path="play/solo/themes/:themeId" element={<LegacyThemeRedirect />} />
          </Route>

          {/* Повноекранні ігрові екрани без нижнього меню */}
          <Route path="play/study/quiz/:themeId/:difficulty" element={<Quiz mode="practice" />} />
          <Route path="play/study/review" element={<Quiz mode="review" />} />
          <Route path="play/study/sprint" element={<Quiz mode="sprint" />} />
          <Route path="play/study/millionaire" element={<Millionaire />} />
          <Route path="play/study/survival" element={<Survival />} />
          <Route path="play/solo/quiz/:themeId/:difficulty" element={<LegacyQuizRedirect />} />
          <Route path="play/solo/millionaire" element={<Navigate to="/play/study/millionaire" replace />} />
          <Route path="play/solo/survival" element={<Navigate to="/play/study/survival" replace />} />
          <Route path="quiz/:themeId/:difficulty" element={<Quiz mode="practice" />} />

          <Route path="play/kahoot" element={<KahootHub />} />
          <Route path="play/kahoot/create" element={<KahootCreate />} />
          <Route path="play/kahoot/join" element={<KahootJoin />} />
          <Route path="play/kahoot/playlists" element={<KahootPlaylists />} />
          <Route path="play/kahoot/playlists/new" element={<KahootPlaylistEditor />} />
          <Route path="play/kahoot/playlists/:playlistId" element={<KahootPlaylistDetails />} />
          <Route path="play/kahoot/playlists/:playlistId/edit" element={<KahootPlaylistEditor />} />
          <Route path="play/kahoot/room/:code" element={<KahootRoom />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </PlayerProvider>
  );
}
