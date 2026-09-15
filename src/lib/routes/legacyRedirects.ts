/**
 * Compatibility redirects (§5.2) for the v2 shell. Only active behind `learningShellV2`
 * — the v1 routes in App.tsx are untouched and keep serving these same paths directly
 * when the flag is off.
 *
 * `matched: true` means the legacy path has an exact (or acceptably general) new-IA
 * destination and redirects silently. `matched: false` means the legacy path carries
 * an id (theme/lesson) that has no resolvable equivalent yet — no learning content is
 * `published` yet (see WS2 notes), so there's no themeId→planId lookup to redirect
 * through — and the user is shown an explanatory compatibility notice instead of being
 * silently bounced to Home, per §5.2's explicit instruction.
 */
export interface LegacyRedirectResult {
  to: string;
  matched: boolean;
}

export type LegacyRedirectId =
  | 'legacyPlayStudy'
  | 'legacyPlayStudyThemes'
  | 'legacyPlayStudyThemeDetail'
  | 'legacyPlayStudyThemeDetailNode'
  | 'legacyPlayStudyThemeDetailAlt'
  | 'legacyPlayStudyLesson'
  | 'legacyPlayStudyReviewQueue'
  | 'legacyPlayStudyQuizStage'
  | 'legacyPlayStudyQuizStageNode'
  | 'legacyPlayStudyQuiz'
  | 'legacyPlayStudyQuizNode'
  | 'legacyPlayStudyReview'
  | 'legacyPlayStudySprint'
  | 'legacyPlayStudyAdaptiveNode'
  | 'legacyPlayStudyAdaptive'
  | 'legacyPlayStudyMicroNode'
  | 'legacyPlayStudyMicro'
  | 'legacyPlayStudyMillionaire'
  | 'legacyPlayStudySurvival'
  | 'legacyThemes'
  | 'legacyThemeDetail'
  | 'legacyQuiz'
  | 'legacyPlaySolo'
  | 'legacyPlaySoloThemeDetail'
  | 'legacyPlaySoloQuiz'
  | 'legacyPlaySoloMillionaire'
  | 'legacyPlaySoloSurvival'
  | 'legacyProfileProgress';

type Params = Record<string, string | undefined>;

interface LegacyRedirectEntry {
  id: LegacyRedirectId;
  /** Legacy path pattern, matching the one registered in App.tsx (documentation only — matching itself is done by the Route). */
  pattern: string;
  resolve: (params: Params, search: string) => LegacyRedirectResult;
}

function withLegacyQuery(base: string, params: Params, keys: [string, string][]): string {
  const search = new URLSearchParams();
  for (const [paramKey, queryKey] of keys) {
    const value = params[paramKey];
    if (value) search.set(queryKey, value);
  }
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

export const LEGACY_REDIRECTS: Record<LegacyRedirectId, LegacyRedirectEntry> = {
  legacyPlayStudy: {
    id: 'legacyPlayStudy',
    pattern: '/play/study',
    resolve: () => ({ to: '/learn', matched: true }),
  },
  legacyPlayStudyThemes: {
    id: 'legacyPlayStudyThemes',
    pattern: '/play/study/themes',
    resolve: () => ({ to: '/learn', matched: true }),
  },
  legacyPlayStudyThemeDetail: {
    id: 'legacyPlayStudyThemeDetail',
    pattern: '/play/study/themes/:themeId',
    resolve: () => ({ to: '/learn', matched: false }),
  },
  legacyPlayStudyThemeDetailNode: {
    id: 'legacyPlayStudyThemeDetailNode',
    pattern: '/play/study/themes/:themeId/:nodeId',
    resolve: () => ({ to: '/learn', matched: false }),
  },
  legacyPlayStudyThemeDetailAlt: {
    id: 'legacyPlayStudyThemeDetailAlt',
    pattern: '/play/study/theme/:themeId',
    resolve: () => ({ to: '/learn', matched: false }),
  },
  legacyPlayStudyLesson: {
    id: 'legacyPlayStudyLesson',
    pattern: '/play/study/lesson/:themeId/:nodeId',
    resolve: () => ({ to: '/learn', matched: false }),
  },
  legacyPlayStudyReviewQueue: {
    id: 'legacyPlayStudyReviewQueue',
    pattern: '/play/study/review-queue/:themeId',
    resolve: () => ({ to: '/review', matched: true }),
  },
  legacyPlayStudyQuizStage: {
    id: 'legacyPlayStudyQuizStage',
    pattern: '/play/study/quiz/:themeId/:difficulty/stage/:stageIndex',
    resolve: (params) => ({
      to: withLegacyQuery('/practice', params, [['themeId', 'legacyTheme'], ['difficulty', 'legacyDifficulty']]),
      matched: true,
    }),
  },
  legacyPlayStudyQuizStageNode: {
    id: 'legacyPlayStudyQuizStageNode',
    pattern: '/play/study/quiz/:themeId/:difficulty/stage/:stageIndex/:nodeId',
    resolve: (params) => ({
      to: withLegacyQuery('/practice', params, [['themeId', 'legacyTheme'], ['difficulty', 'legacyDifficulty']]),
      matched: true,
    }),
  },
  legacyPlayStudyQuiz: {
    id: 'legacyPlayStudyQuiz',
    pattern: '/play/study/quiz/:themeId/:difficulty',
    resolve: (params) => ({
      to: withLegacyQuery('/practice', params, [['themeId', 'legacyTheme'], ['difficulty', 'legacyDifficulty']]),
      matched: true,
    }),
  },
  legacyPlayStudyQuizNode: {
    id: 'legacyPlayStudyQuizNode',
    pattern: '/play/study/quiz/:themeId/:difficulty/:nodeId',
    resolve: (params) => ({
      to: withLegacyQuery('/practice', params, [['themeId', 'legacyTheme'], ['difficulty', 'legacyDifficulty']]),
      matched: true,
    }),
  },
  legacyPlayStudyReview: {
    id: 'legacyPlayStudyReview',
    pattern: '/play/study/review',
    resolve: () => ({ to: '/review', matched: true }),
  },
  legacyPlayStudySprint: {
    id: 'legacyPlayStudySprint',
    pattern: '/play/study/sprint',
    resolve: () => ({ to: '/learn', matched: true }),
  },
  legacyPlayStudyAdaptiveNode: {
    id: 'legacyPlayStudyAdaptiveNode',
    pattern: '/play/study/adaptive/:themeId/:nodeId',
    resolve: () => ({ to: '/learn', matched: true }),
  },
  legacyPlayStudyAdaptive: {
    id: 'legacyPlayStudyAdaptive',
    pattern: '/play/study/adaptive',
    resolve: () => ({ to: '/learn', matched: true }),
  },
  legacyPlayStudyMicroNode: {
    id: 'legacyPlayStudyMicroNode',
    pattern: '/play/study/micro/:themeId/:nodeId',
    resolve: () => ({ to: '/learn', matched: true }),
  },
  legacyPlayStudyMicro: {
    id: 'legacyPlayStudyMicro',
    pattern: '/play/study/micro',
    resolve: () => ({ to: '/learn', matched: true }),
  },
  legacyPlayStudyMillionaire: {
    id: 'legacyPlayStudyMillionaire',
    pattern: '/play/study/millionaire',
    resolve: () => ({ to: '/play/millionaire', matched: true }),
  },
  legacyPlayStudySurvival: {
    id: 'legacyPlayStudySurvival',
    pattern: '/play/study/survival',
    resolve: () => ({ to: '/play/survival', matched: true }),
  },
  legacyThemes: {
    id: 'legacyThemes',
    pattern: '/themes',
    resolve: () => ({ to: '/learn', matched: true }),
  },
  legacyThemeDetail: {
    id: 'legacyThemeDetail',
    pattern: '/themes/:themeId',
    resolve: () => ({ to: '/learn', matched: false }),
  },
  legacyQuiz: {
    id: 'legacyQuiz',
    pattern: '/quiz/:themeId/:difficulty',
    resolve: (params) => ({
      to: withLegacyQuery('/practice', params, [['themeId', 'legacyTheme'], ['difficulty', 'legacyDifficulty']]),
      matched: true,
    }),
  },
  legacyPlaySolo: {
    id: 'legacyPlaySolo',
    pattern: '/play/solo',
    resolve: () => ({ to: '/learn', matched: true }),
  },
  legacyPlaySoloThemeDetail: {
    id: 'legacyPlaySoloThemeDetail',
    pattern: '/play/solo/themes/:themeId',
    resolve: () => ({ to: '/learn', matched: false }),
  },
  legacyPlaySoloQuiz: {
    id: 'legacyPlaySoloQuiz',
    pattern: '/play/solo/quiz/:themeId/:difficulty',
    resolve: (params) => ({
      to: withLegacyQuery('/practice', params, [['themeId', 'legacyTheme'], ['difficulty', 'legacyDifficulty']]),
      matched: true,
    }),
  },
  legacyPlaySoloMillionaire: {
    id: 'legacyPlaySoloMillionaire',
    pattern: '/play/solo/millionaire',
    resolve: () => ({ to: '/play/millionaire', matched: true }),
  },
  legacyPlaySoloSurvival: {
    id: 'legacyPlaySoloSurvival',
    pattern: '/play/solo/survival',
    resolve: () => ({ to: '/play/survival', matched: true }),
  },
  legacyProfileProgress: {
    id: 'legacyProfileProgress',
    pattern: '/profile/progress',
    resolve: () => ({ to: '/progress', matched: true }),
  },
};
