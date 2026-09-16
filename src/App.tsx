import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthSessionProvider } from './context/AuthSessionContext';
import { MotionProvider } from './components/motion/MotionProvider';
import { PlayerDataBootstrap } from './components/PlayerDataBootstrap';
import { CosmeticThemeSync } from './components/CosmeticThemeSync';
import { VantProvider } from './components/VantProvider';
import { TopicHierarchyProvider } from './context/TopicHierarchyContext';
import { Layout } from './components/Layout';
import { AppShellV2 } from './components/shell/AppShellV2';
import { ComingSoon } from './components/shell/ComingSoon';
import { LegacyRedirect } from './components/shell/LegacyRedirect';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppSkeleton } from './components/skeletons';
import { useTelegramBackButton } from './hooks/useTelegram';
import { isFeatureEnabled } from './lib/flags';
import { LEGACY_REDIRECTS } from './lib/routes/legacyRedirects';

// Static per session (env-driven, see `lib/flags.ts`) — computed once, mirrors
// `Layout.tsx`'s existing `learningFirstNav` pattern.
const learningShellV2Enabled = isFeatureEnabled('learningShellV2');

// WS6 reuses these three pre-existing (previously dead) flags rather than the
// plan doc's `todayV1`/`lessonRendererV1` names. They are also read by legacy
// v1 pages (`Home.tsx`, `ThemeDetail.tsx`) that WS6 does not touch — flipping
// one on additionally reveals that legacy section, a documented, harmless
// overlap (see the WS6 plan's "Flags" note), not a functional regression.
const todayDashboardEnabled = isFeatureEnabled('today_dashboard');
const learningPlansEnabled = isFeatureEnabled('learning_plans');
const lessonExperienceV2Enabled = isFeatureEnabled('lesson_experience_v2');

// WS7 (Practice/review + Progress). `practiceSessionV2` is a new flag — the
// three practice/review routes are one coupled feature (review launches a
// practice session) so they share a single gate rather than each reusing a
// different pre-existing dead flag. `progress_dashboard_v2` is reused
// (pre-existing, previously dead) — same overlap pattern as WS6's Today/Learn
// flags: it also gates an unrelated legacy `Profile.tsx` section.
const practiceSessionV2Enabled = isFeatureEnabled('practiceSessionV2');
const progressDashboardV2Enabled = isFeatureEnabled('progress_dashboard_v2');

// WS8 (Profile/settings + default-theme rollout). New flag — no legacy page
// reads it, so there's no overlap to document (unlike the flags above).
const profileSettingsV2Enabled = isFeatureEnabled('profileSettingsV2');

const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const Themes = lazy(() => import('./pages/Themes').then((m) => ({ default: m.Themes })));
const ThemeDetail = lazy(() =>
  import('./pages/ThemeDetail').then((m) => ({ default: m.ThemeDetail })),
);
const Lesson = lazy(() => import('./pages/Lesson').then((m) => ({ default: m.Lesson })));
const ReviewQueue = lazy(() =>
  import('./pages/ReviewQueue').then((m) => ({ default: m.ReviewQueue })),
);
const ProgressDashboard = lazy(() =>
  import('./pages/ProgressDashboard').then((m) => ({ default: m.ProgressDashboard })),
);
const Quiz = lazy(() => import('./pages/Quiz').then((m) => ({ default: m.Quiz })));
const StudyHub = lazy(() => import('./pages/StudyHub').then((m) => ({ default: m.StudyHub })));
const Today = lazy(() => import('./pages/learn/Today').then((m) => ({ default: m.Today })));
const LearningHub = lazy(() =>
  import('./pages/learn/LearningHub').then((m) => ({ default: m.LearningHub })),
);
const PlanDetail = lazy(() =>
  import('./pages/learn/PlanDetail').then((m) => ({ default: m.PlanDetail })),
);
const ModuleDetail = lazy(() =>
  import('./pages/learn/ModuleDetail').then((m) => ({ default: m.ModuleDetail })),
);
const LessonSession = lazy(() =>
  import('./pages/learn/LessonSession').then((m) => ({ default: m.LessonSession })),
);
const PracticeIntent = lazy(() =>
  import('./pages/practice/PracticeIntent').then((m) => ({ default: m.PracticeIntent })),
);
const PracticeSession = lazy(() =>
  import('./pages/practice/PracticeSession').then((m) => ({ default: m.PracticeSession })),
);
const ReviewHub = lazy(() => import('./pages/practice/ReviewHub').then((m) => ({ default: m.ReviewHub })));
const ProgressV2 = lazy(() =>
  import('./pages/progress/ProgressV2').then((m) => ({ default: m.ProgressV2 })),
);
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })));
const ProfileV2 = lazy(() =>
  import('./pages/profile/ProfileV2').then((m) => ({ default: m.ProfileV2 })),
);
const Settings = lazy(() =>
  import('./pages/profile/Settings').then((m) => ({ default: m.Settings })),
);
const ThemePicker = lazy(() =>
  import('./pages/profile/ThemePicker').then((m) => ({ default: m.ThemePicker })),
);
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
// Dev-only WS3 visual QA harness (DESIGN_RULES §20.3) — tree-shaken out of production builds.
const DesignSystemFixture = import.meta.env.DEV
  ? lazy(() =>
      import('./pages/dev/DesignSystemFixture').then((m) => ({ default: m.DesignSystemFixture })),
    )
  : null;

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
    <AuthSessionProvider>
      <QueryClientProvider client={queryClient}>
      <MotionProvider>
      <PlayerDataBootstrap>
      <CosmeticThemeSync />
      <VantProvider>
      <ToastProvider>
      <BrowserRouter
        basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}
      >
          <TelegramBackButtonSync />
          <Routes>
            {learningShellV2Enabled ? (
              <Route element={<AppShellV2 />}>
                <Route
                  index
                  element={
                    todayDashboardEnabled ? (
                      <ErrorBoundary><LazyPage><Today /></LazyPage></ErrorBoundary>
                    ) : (
                      <ErrorBoundary><LazyPage><Home /></LazyPage></ErrorBoundary>
                    )
                  }
                />

                {/* Learn (§5.1, WS6) — real screens behind their flags; each falls back to
                    the prior behavior (existing study hub / ComingSoon) when off. */}
                <Route
                  path="learn"
                  element={
                    learningPlansEnabled ? (
                      <ErrorBoundary><LazyPage><LearningHub /></LazyPage></ErrorBoundary>
                    ) : (
                      <ErrorBoundary><LazyPage><StudyHub /></LazyPage></ErrorBoundary>
                    )
                  }
                />
                <Route
                  path="learn/plans/:planId"
                  element={
                    lessonExperienceV2Enabled ? (
                      <ErrorBoundary><LazyPage><PlanDetail /></LazyPage></ErrorBoundary>
                    ) : (
                      <ComingSoon icon="book" title="План навчання" description="Перегляд планів з'явиться найближчим часом." />
                    )
                  }
                />
                <Route
                  path="learn/plans/:planId/modules/:moduleId"
                  element={
                    lessonExperienceV2Enabled ? (
                      <ErrorBoundary><LazyPage><ModuleDetail /></LazyPage></ErrorBoundary>
                    ) : (
                      <ComingSoon icon="book" title="Модуль" description="Перегляд модулів з'явиться найближчим часом." />
                    )
                  }
                />
                <Route
                  path="learn/lessons/:lessonId"
                  element={
                    lessonExperienceV2Enabled ? (
                      <ErrorBoundary><LazyPage><LessonSession /></LazyPage></ErrorBoundary>
                    ) : (
                      <ComingSoon icon="book" title="Урок" description="Новий формат уроку ще будується." />
                    )
                  }
                />

                {/* Practice / Review (§5.1, §12, WS7) — session creation by
                    intent + scheduler UI, behind `practiceSessionV2`. */}
                <Route
                  path="practice"
                  element={
                    practiceSessionV2Enabled ? (
                      <ErrorBoundary><LazyPage><PracticeIntent /></LazyPage></ErrorBoundary>
                    ) : (
                      <ComingSoon icon="brain" title="Практика" description="Новий розділ практики ще будується." />
                    )
                  }
                />
                <Route
                  path="practice/session/:sessionId"
                  element={
                    practiceSessionV2Enabled ? (
                      <ErrorBoundary><LazyPage><PracticeSession /></LazyPage></ErrorBoundary>
                    ) : (
                      <ComingSoon icon="brain" title="Сесія практики" description="Новий формат сесії ще будується." />
                    )
                  }
                />
                <Route
                  path="review"
                  element={
                    practiceSessionV2Enabled ? (
                      <ErrorBoundary><LazyPage><ReviewHub /></LazyPage></ErrorBoundary>
                    ) : (
                      <ComingSoon icon="clock" title="Повторення" description="Новий розділ повторення ще будується." />
                    )
                  }
                />

                <Route path="play" element={<ErrorBoundary><LazyPage><PlayHub /></LazyPage></ErrorBoundary>} />
                <Route path="play/millionaire" element={<ErrorBoundary><LazyPage><Millionaire /></LazyPage></ErrorBoundary>} />
                <Route path="play/survival" element={<ErrorBoundary><LazyPage><Survival /></LazyPage></ErrorBoundary>} />
                <Route path="play/kahoot" element={<ErrorBoundary><LazyPage><KahootHub /></LazyPage></ErrorBoundary>} />
                <Route path="play/kahoot/create" element={<ErrorBoundary><LazyPage><KahootCreate /></LazyPage></ErrorBoundary>} />
                <Route path="play/kahoot/join" element={<ErrorBoundary><LazyPage><KahootJoin /></LazyPage></ErrorBoundary>} />
                <Route path="play/kahoot/playlists" element={<ErrorBoundary><LazyPage><KahootPlaylists /></LazyPage></ErrorBoundary>} />
                <Route path="play/kahoot/playlists/new" element={<ErrorBoundary><LazyPage><KahootPlaylistEditor /></LazyPage></ErrorBoundary>} />
                <Route path="play/kahoot/playlists/:playlistId" element={<ErrorBoundary><LazyPage><KahootPlaylistDetails /></LazyPage></ErrorBoundary>} />
                <Route path="play/kahoot/playlists/:playlistId/edit" element={<ErrorBoundary><LazyPage><KahootPlaylistEditor /></LazyPage></ErrorBoundary>} />
                <Route path="play/kahoot/room/:code" element={<ErrorBoundary><LazyPage><KahootRoom /></LazyPage></ErrorBoundary>} />
                <Route path="play/kahoot/display/:code" element={<ErrorBoundary><LazyPage><KahootDisplay /></LazyPage></ErrorBoundary>} />

                <Route
                  path="progress"
                  element={
                    progressDashboardV2Enabled ? (
                      <ErrorBoundary><LazyPage><ProgressV2 /></LazyPage></ErrorBoundary>
                    ) : (
                      <ErrorBoundary><LazyPage><ProgressDashboard /></LazyPage></ErrorBoundary>
                    )
                  }
                />

                <Route
                  path="profile"
                  element={
                    profileSettingsV2Enabled ? (
                      <ErrorBoundary><LazyPage><ProfileV2 /></LazyPage></ErrorBoundary>
                    ) : (
                      <ErrorBoundary><LazyPage><Profile /></LazyPage></ErrorBoundary>
                    )
                  }
                />
                <Route
                  path="profile/settings"
                  element={
                    profileSettingsV2Enabled ? (
                      <ErrorBoundary><LazyPage><Settings /></LazyPage></ErrorBoundary>
                    ) : (
                      <ComingSoon icon="settings" title="Налаштування" description="Окремий екран налаштувань ще будується." />
                    )
                  }
                />
                <Route
                  path="profile/themes"
                  element={
                    profileSettingsV2Enabled ? (
                      <ErrorBoundary><LazyPage><ThemePicker /></LazyPage></ErrorBoundary>
                    ) : (
                      <ComingSoon icon="star" title="Оформлення" description="Вибір теми оформлення ще будується." />
                    )
                  }
                />

                <Route path="shop" element={<ErrorBoundary><LazyPage><Shop /></LazyPage></ErrorBoundary>} />
                <Route path="admin" element={<ErrorBoundary><LazyPage><AdminPanel /></LazyPage></ErrorBoundary>} />
                <Route path="stats" element={<ErrorBoundary><LazyPage><GlobalStats /></LazyPage></ErrorBoundary>} />
                <Route path="social/challenges" element={<ErrorBoundary><LazyPage><Challenges /></LazyPage></ErrorBoundary>} />
                <Route path="social/challenges/:challengeId" element={<ErrorBoundary><LazyPage><ChallengeDetails /></LazyPage></ErrorBoundary>} />
                <Route path="social/communities" element={<ErrorBoundary><LazyPage><Communities /></LazyPage></ErrorBoundary>} />
                <Route path="social/communities/:communityId" element={<ErrorBoundary><LazyPage><CommunityDetails /></LazyPage></ErrorBoundary>} />

                {/* Compatibility redirects (§5.2) for every legacy path, data-driven from
                    `lib/routes/legacyRedirects.ts` so the mapping table and the route
                    registration can't drift apart. */}
                {Object.values(LEGACY_REDIRECTS).map((entry) => (
                  <Route
                    key={entry.id}
                    path={entry.pattern.slice(1)}
                    element={<LegacyRedirect entryId={entry.id} />}
                  />
                ))}
              </Route>
            ) : (
              <>
                <Route element={<Layout />}>
                  <Route index element={<ErrorBoundary><LazyPage><Home /></LazyPage></ErrorBoundary>} />
                  <Route path="play" element={<ErrorBoundary><LazyPage><PlayHub /></LazyPage></ErrorBoundary>} />
                  <Route path="play/study" element={<ErrorBoundary><LazyPage><StudyHub /></LazyPage></ErrorBoundary>} />
                  <Route
                    path="play/study/themes"
                    element={
                      <TopicHierarchyProvider>
                        <ErrorBoundary><LazyPage><Themes /></LazyPage></ErrorBoundary>
                      </TopicHierarchyProvider>
                    }
                  />
                  <Route path="play/study/themes/:themeId" element={<ErrorBoundary><LazyPage><ThemeDetail /></LazyPage></ErrorBoundary>} />
                  <Route path="play/study/themes/:themeId/:nodeId" element={<ErrorBoundary><LazyPage><ThemeDetail /></LazyPage></ErrorBoundary>} />
                  <Route path="play/study/theme/:themeId" element={<ErrorBoundary><LazyPage><ThemeDetail /></LazyPage></ErrorBoundary>} />
                  <Route path="play/study/lesson/:themeId/:nodeId" element={<ErrorBoundary><LazyPage><Lesson /></LazyPage></ErrorBoundary>} />
                  <Route path="play/study/review-queue/:themeId" element={<ErrorBoundary><LazyPage><ReviewQueue /></LazyPage></ErrorBoundary>} />
                  <Route path="profile" element={<ErrorBoundary><LazyPage><Profile /></LazyPage></ErrorBoundary>} />
                  <Route path="profile/progress" element={<ErrorBoundary><LazyPage><ProgressDashboard /></LazyPage></ErrorBoundary>} />
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
              </>
            )}

            {DesignSystemFixture && (
              <Route path="dev/design-system" element={<LazyPage><DesignSystemFixture /></LazyPage>} />
            )}

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
      </BrowserRouter>
      </ToastProvider>
      </VantProvider>
      </PlayerDataBootstrap>
      </MotionProvider>
      </QueryClientProvider>
    </AuthSessionProvider>
  );
}
