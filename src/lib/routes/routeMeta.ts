import { matchPath } from 'react-router-dom';

/**
 * Bottom-nav tabs for the v2 shell (learningShellV2). Per DESIGN_RULES §14.2,
 * Shop is explicitly NOT a core tab ("Крамниця не займає core learning tab");
 * Play/Shop/Social are reached from Home/Profile, not the tab bar.
 */
export type TabKey = 'home' | 'learn' | 'practice' | 'progress' | 'profile';

export const TAB_ORDER: TabKey[] = ['home', 'learn', 'practice', 'progress', 'profile'];

export interface RouteMeta {
  /** Stable id used for analytics + lookups — not shown to users. */
  id: string;
  /** React Router path pattern, relative to the router basename. */
  pattern: string;
  /** Bottom-nav tab this route belongs to, or null for routes outside the tab bar. */
  tab: TabKey | null;
  /** Hides the bottom nav / tab chrome (§5.4: quiz, active lesson, Millionaire, Kahoot room). */
  fullscreen: boolean;
  /** Route analytics identifier (§5.3). */
  analyticsId: string;
}

/**
 * Central route metadata (§5.1/§5.4/§6 "Navigation state") — the single source of
 * truth for active-tab and fullscreen-chrome decisions in the v2 shell, replacing
 * path-substring checks. Order doesn't affect matching (matchPath does exact
 * pattern matching per entry), but keep it roughly grouped by tab for readability.
 */
export const ROUTE_REGISTRY: RouteMeta[] = [
  { id: 'home', pattern: '/', tab: 'home', fullscreen: false, analyticsId: 'home' },

  { id: 'learn', pattern: '/learn', tab: 'learn', fullscreen: false, analyticsId: 'learn_hub' },
  {
    id: 'learnPlan',
    pattern: '/learn/plans/:planId',
    tab: 'learn',
    fullscreen: false,
    analyticsId: 'learn_plan_detail',
  },
  {
    id: 'learnModule',
    pattern: '/learn/plans/:planId/modules/:moduleId',
    tab: 'learn',
    fullscreen: false,
    analyticsId: 'learn_module_detail',
  },
  {
    id: 'learnLesson',
    pattern: '/learn/lessons/:lessonId',
    tab: 'learn',
    fullscreen: true,
    analyticsId: 'learn_lesson_session',
  },

  { id: 'practice', pattern: '/practice', tab: 'practice', fullscreen: false, analyticsId: 'practice_hub' },
  {
    id: 'practiceSession',
    pattern: '/practice/session/:sessionId',
    tab: 'practice',
    fullscreen: true,
    analyticsId: 'practice_session',
  },
  { id: 'review', pattern: '/review', tab: 'practice', fullscreen: false, analyticsId: 'review_queue' },

  { id: 'play', pattern: '/play', tab: null, fullscreen: false, analyticsId: 'play_hub' },
  { id: 'playMillionaire', pattern: '/play/millionaire', tab: null, fullscreen: false, analyticsId: 'play_millionaire' },
  { id: 'playSurvival', pattern: '/play/survival', tab: null, fullscreen: false, analyticsId: 'play_survival' },
  { id: 'playKahootHub', pattern: '/play/kahoot', tab: null, fullscreen: false, analyticsId: 'play_kahoot_hub' },
  { id: 'playKahootCreate', pattern: '/play/kahoot/create', tab: null, fullscreen: false, analyticsId: 'play_kahoot_create' },
  { id: 'playKahootJoin', pattern: '/play/kahoot/join', tab: null, fullscreen: false, analyticsId: 'play_kahoot_join' },
  { id: 'playKahootPlaylists', pattern: '/play/kahoot/playlists', tab: null, fullscreen: false, analyticsId: 'play_kahoot_playlists' },
  { id: 'playKahootPlaylistNew', pattern: '/play/kahoot/playlists/new', tab: null, fullscreen: false, analyticsId: 'play_kahoot_playlist_editor' },
  { id: 'playKahootPlaylistDetail', pattern: '/play/kahoot/playlists/:playlistId', tab: null, fullscreen: false, analyticsId: 'play_kahoot_playlist_detail' },
  { id: 'playKahootPlaylistEdit', pattern: '/play/kahoot/playlists/:playlistId/edit', tab: null, fullscreen: false, analyticsId: 'play_kahoot_playlist_editor' },
  // Fullscreen parity with the v1 Layout (`hideNav` matched `/kahoot/room/`) — an active
  // multiplayer round hides the tab bar; the display/spectator screen does not.
  { id: 'playKahootRoom', pattern: '/play/kahoot/room/:code', tab: null, fullscreen: true, analyticsId: 'play_kahoot_room' },
  { id: 'playKahootDisplay', pattern: '/play/kahoot/display/:code', tab: null, fullscreen: false, analyticsId: 'play_kahoot_display' },

  { id: 'progress', pattern: '/progress', tab: 'progress', fullscreen: false, analyticsId: 'progress' },

  { id: 'profile', pattern: '/profile', tab: 'profile', fullscreen: false, analyticsId: 'profile' },
  { id: 'profileSettings', pattern: '/profile/settings', tab: 'profile', fullscreen: false, analyticsId: 'profile_settings' },
  { id: 'profileThemes', pattern: '/profile/themes', tab: 'profile', fullscreen: false, analyticsId: 'profile_themes' },

  { id: 'shop', pattern: '/shop', tab: null, fullscreen: false, analyticsId: 'shop' },
  { id: 'socialCommunities', pattern: '/social/communities', tab: null, fullscreen: false, analyticsId: 'social_communities' },
  { id: 'socialCommunityDetail', pattern: '/social/communities/:communityId', tab: null, fullscreen: false, analyticsId: 'social_community_detail' },
  { id: 'socialChallenges', pattern: '/social/challenges', tab: null, fullscreen: false, analyticsId: 'social_challenges' },
  { id: 'socialChallengeDetail', pattern: '/social/challenges/:challengeId', tab: null, fullscreen: false, analyticsId: 'social_challenge_detail' },
];

export function matchRouteMeta(pathname: string): RouteMeta | undefined {
  return ROUTE_REGISTRY.find((entry) => matchPath({ path: entry.pattern, end: true }, pathname) != null);
}

/** Active bottom-nav tab for a pathname, driven by route metadata (§6 "Navigation state"). */
export function getActiveTab(pathname: string): TabKey | null {
  return matchRouteMeta(pathname)?.tab ?? null;
}

/** Whether the route hides the bottom-nav chrome (§5.4), driven by route metadata. */
export function isFullscreenRoute(pathname: string): boolean {
  return matchRouteMeta(pathname)?.fullscreen ?? false;
}

/**
 * Coarse forward/backward hint between two tabs, based on their order in the tab
 * bar. Exposed for future directional transitions (WS4 deferred §7.2 route/tab
 * presets pending this); the v2 shell itself only uses opacity-only tab transitions
 * (`layoutTabVariants`) by design — see `src/lib/motion.ts`.
 */
export function getTabDirection(from: TabKey | null, to: TabKey | null): 'forward' | 'backward' | 'none' {
  if (!from || !to || from === to) return 'none';
  return TAB_ORDER.indexOf(to) > TAB_ORDER.indexOf(from) ? 'forward' : 'backward';
}
