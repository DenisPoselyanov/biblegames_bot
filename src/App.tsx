import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { PlayerProvider } from './context/PlayerContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Themes } from './pages/Themes';
import { ThemeDetail } from './pages/ThemeDetail';
import { Quiz } from './pages/Quiz';
import { Profile } from './pages/Profile';
import { GlobalStats } from './pages/GlobalStats';
import { PlayHub } from './pages/play/PlayHub';
import { KahootHub } from './pages/play/kahoot/KahootHub';
import { KahootCreate } from './pages/play/kahoot/KahootCreate';
import { KahootJoin } from './pages/play/kahoot/KahootJoin';
import { KahootRoom } from './pages/play/kahoot/KahootRoom';

function LegacyThemeRedirect() {
  const { themeId } = useParams<{ themeId: string }>();
  return <Navigate to={`/play/solo/themes/${themeId}`} replace />;
}

export default function App() {
  return (
    <PlayerProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="play" element={<PlayHub />} />
            <Route path="play/solo" element={<Themes />} />
            <Route path="play/solo/themes/:themeId" element={<ThemeDetail />} />
            <Route path="profile" element={<Profile />} />
            <Route path="stats" element={<GlobalStats />} />

            {/* Старі URL → нові */}
            <Route path="themes" element={<Navigate to="/play/solo" replace />} />
            <Route path="themes/:themeId" element={<LegacyThemeRedirect />} />
          </Route>

          {/* Повноекранні ігрові екрани без нижнього меню */}
          <Route path="play/solo/quiz/:themeId/:difficulty" element={<Quiz />} />
          <Route path="quiz/:themeId/:difficulty" element={<Quiz />} />

          <Route path="play/kahoot" element={<KahootHub />} />
          <Route path="play/kahoot/create" element={<KahootCreate />} />
          <Route path="play/kahoot/join" element={<KahootJoin />} />
          <Route path="play/kahoot/room/:code" element={<KahootRoom />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </PlayerProvider>
  );
}
