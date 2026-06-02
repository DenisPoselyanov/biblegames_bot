import type { BollsTranslation } from '../lib/bollsConstants';

export type Difficulty = 'baby' | 'child' | 'youth' | 'student' | 'preacher' | 'teacher' | 'theologian';

export interface Category {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  themeIds: string[];
}

export interface Theme {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  categoryId: string;
}

export interface Question {
  id: string;
  themeId: string;
  difficulty: Difficulty;
  text: string;
  options: string[];
  correctIndex: number;
  reference?: string;
  explanationShort?: string;
  explanationDeep?: string;
  sourceQuality?: 'verified' | 'community' | 'ai-reviewed' | 'ai-draft';
  // Поля для системи якості (Phase 3)
  ambiguityScore?: number; // 0-100, менше = краще
  qualityScore?: number; // 0-100, більше = краще
  duplicateIds?: string[]; // ID подібних питань
  poolType?: 'study' | 'game' | 'both'; // Тип пулу питань
  tags?: string[]; // Додаткові теги для категоризації
  createdAt?: string; // Дата створення
  lastReviewedAt?: string; // Дата останнього перегляду
  quarantined?: boolean; // Чи в карантині
  quarantineReason?: string; // Причина карантину
  /** Вузол ієрархії topics-db (для фільтрації підтем) */
  topicNodeId?: string;
  topicPath?: string;
}

export interface CompletedLevel {
  themeId: string;
  difficulty: Difficulty;
  score: number;
  maxScore: number;
  completedAt: string;
}

export interface PracticeStageResult {
  stageIndex: number;
  correct: number;
  total: number;
  /** Best correct answers reached for this stage across all attempts */
  bestCorrect?: number;
  /** Highest awarded theme points for this stage across all attempts */
  bestPointsAwarded?: number;
  /** Highest awarded wisdom for this stage across all attempts */
  bestWisdomAwarded?: number;
  /** True once the stage has been solved with all answers correct */
  perfect?: boolean;
  /** Timestamp of the first perfect completion */
  perfectCompletedAt?: string;
  passed: boolean;
  completedAt: string;
}

export interface PracticeTrackProgress {
  themeId: string;
  nodeId: string | null;
  difficulty: Difficulty;
  /** 0-based index of the highest unlocked stage */
  highestUnlockedStage: number;
  stageResults: PracticeStageResult[];
}

export interface PlayerRank {
  tier: Difficulty;
  /** Sub-level badge 7 (lowest) … 1 (highest within tier) */
  plaque: number;
  wisdomPoints: number;
  /** Highest global rank visible in the progression roadmap */
  unlockedTier: Difficulty;
}

export interface PlayerProfile {
  userId: string;
  displayName: string;
  themePoints: Record<string, number>;
  completedLevels: CompletedLevel[];
  survivalHighScore: number;
  millionaireWins: number;
  millionaireMaxLevel: number;
  unlockedThemes: string[];
  activeTheme: string;
  achievements: string[];
  avatar: string;
  /** Єдина економічна валюта: заробіток, крамниця, бонуси */
  coins: number;
  unlockedAvatars: string[];
  streakDays: number;
  lastActiveAt: string | null;
  studyMastery: Record<string, MasteryState>;
  /** Переклад Писання (bolls.life): HOM | UBIO | UTT */
  bibleTranslation?: BollsTranslation;
  practiceTracks: PracticeTrackProgress[];
  playerRank: PlayerRank;
}

export interface MasteryState {
  mastery: number;
  confidence: number;
  lastReviewedAt: string | null;
  errorTags: string[];
  correctStreak: number;
  wrongCount: number;
  totalAnswers: number;
  // Поля для ієрархічного контексту
  nodeId?: string; // TopicNode ID для ієрархічного відстеження
  hierarchyDepth?: number; // Глибина в ієрархії
  parentMastery?: number; // Mastery батьківського вузла
  childMastery?: Record<string, number>; // Mastery дочірніх вузлів
}

export interface StudyPathNode {
  subthemeId: string;
  priority: number;
  reason: 'new' | 'weakness' | 'scheduled-review';
}

export interface StudyPath {
  generatedAt: string;
  nodes: StudyPathNode[];
}

export type StudyMode = 'practice' | 'review';

export interface StudySession {
  id: string;
  userId: string;
  mode: StudyMode;
  subthemeId: string;
  // Поля для ієрархічного контексту
  selectedNodeId?: string; // Обраний TopicNode для практики
  hierarchyPath?: string[]; // Шлях до обраного вузла (батьківські IDs)
  hierarchyDepth?: number; // Глибина в ієрархії
  startedAt: string;
  finishedAt?: string;
  answers: AnswerEvent[];
}

export interface AnswerEvent {
  questionId: string;
  subthemeId: string;
  isCorrect: boolean;
  answeredAt: string;
  responseMs?: number;
  selectedIndex?: number;
  correctIndex?: number;
  errorTag?: string;
  // Поля для ієрархічного контексту
  nodeId?: string; // TopicNode ID
  hierarchyDepth?: number; // Глибина в ієрархії
}

export interface DailyTask {
  id: string;
  title: string;
  goal: number;
  progress: number;
  completed: boolean;
}

export interface LearningInsight {
  masteredSubthemes: number;
  accuracy7d: number;
  accuracy30d: number;
  retention24h: number;
  retention72h: number;
}

export interface ThemeGlobalStats {
  themeId: string;
  totalPoints: number;
  gamesPlayed: number;
  playersCount: number;
}

export interface GlobalStats {
  themes: Record<string, ThemeGlobalStats>;
  lastUpdated: string;
}

export const DIFFICULTIES: Difficulty[] = [
  'baby',
  'child',
  'youth',
  'student',
  'preacher',
  'teacher',
  'theologian',
];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  baby: 'Немовля',
  child: 'Дитина',
  youth: 'Юнак',
  student: 'Учень',
  preacher: 'Проповідник',
  teacher: 'Учитель',
  theologian: 'Богослов',
};

export const DIFFICULTY_POINTS: Record<Difficulty, number> = {
  baby: 5,
  child: 15,
  youth: 30,
  student: 50,
  preacher: 80,
  teacher: 120,
  theologian: 200,
};

export const QUESTIONS_PER_LEVEL = 7;

export const DIFFICULTY_ORDER: Record<Difficulty, number> = {
  baby: 0,
  child: 1,
  youth: 2,
  student: 3,
  preacher: 4,
  teacher: 5,
  theologian: 6,
};

export function isValidDifficulty(value: string): value is Difficulty {
  return DIFFICULTIES.includes(value as Difficulty);
}

/** Ієрархічний вузол теми (рекурсивний — підтеми будь-якої глибини) */
export interface TopicNode {
  id: string;
  title: string;
  description: string;
  icon: string;
  children: TopicNode[];
  questionCount?: number;
  // Додаткові поля для інтеграції
  themeId?: string; // Зв'язок з існуючою Theme
  depth?: number; // Глибина в ієрархії
  parentId?: string; // ID батьківського вузла
  difficulty?: Difficulty; // Рекомендована складність
  estimatedTime?: number; // Оцінний час навчання в хвилинах
  aggregateThemeIds?: string[]; // Для вузла "Всі питання" — список themeId для агрегації
}

/** Мапа ієрархій тем: themeId → кореневий TopicNode */
export type TopicHierarchyMap = Record<string, TopicNode>;

// Типи для системи якості питань (Phase 3)
export type QuestionQualityStatus = 'pending' | 'approved' | 'rejected' | 'quarantined';

export interface QuestionQualityReport {
  questionId: string;
  status: QuestionQualityStatus;
  ambiguityScore: number;
  qualityScore: number;
  duplicateIds: string[];
  issues: QualityIssue[];
  reviewedAt?: string;
  reviewedBy?: string;
}

export type ExplanationCoverage = 'missing' | 'short_only' | 'complete' | 'orphan_deep';

export interface ExplanationQualityReport {
  questionId: string;
  themeId: string;
  coverage: ExplanationCoverage;
  heuristicScore: number;
  coverageScore?: number;
  aiScore?: number | null;
  aiDetails?: {
    accuracy?: number;
    clarity?: number;
    pedagogicalValue?: number;
    ageAppropriate?: number;
    summary?: string;
  } | null;
  issues: QualityIssue[];
  explanationShortPreview?: string;
  reviewedAt?: string | null;
  text?: string;
  source?: string;
}

export interface QualityIssue {
  type:
    | 'duplicate'
    | 'ambiguous'
    | 'unclear_reference'
    | 'wrong_difficulty'
    | 'typo'
    | 'theological_error'
    | 'missing_explanation'
    | 'too_short'
    | 'too_long_short'
    | 'repeats_answer'
    | 'contradicts_answer'
    | 'duplicates_question'
    | 'no_scripture_context'
    | 'theological_red_flag'
    | 'generic_filler'
    | 'orphan_deep';
  severity: 'low' | 'medium' | 'high';
  message: string;
  autoFixable?: boolean;
}

export interface QuestionQuarantine {
  questionId: string;
  reason: string;
  quarantinedAt: string;
  quarantinedBy: string;
  status: 'pending_review' | 'approved_fix' | 'rejected';
  proposedFix?: string;
}

// Типи для соціальних функцій (Phase 3)
export interface Playlist {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  creatorName: string;
  questions: string[]; // Question IDs
  themes: string[]; // Theme IDs
  isPublic: boolean;
  plays: number;
  likes: number;
  createdAt: string;
  updatedAt: string;
}

export interface FriendChallenge {
  id: string;
  challengerId: string;
  challengerName: string;
  challengerScore: number;
  challengedId: string;
  challengedName: string;
  challengedScore?: number;
  status: 'pending' | 'accepted' | 'completed' | 'declined';
  themeId?: string;
  difficulty?: Difficulty;
  questions: string[]; // Question IDs
  createdAt: string;
  expiresAt: string;
  completedAt?: string;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  memberIds: string[];
  isPublic: boolean;
  createdAt: string;
}

export interface CommunityLeaderboard {
  communityId: string;
  period: 'weekly' | 'monthly' | 'all_time';
  entries: LeaderboardEntry[];
  lastUpdated: string;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  score: number;
  gamesPlayed: number;
  accuracy: number;
}

export interface SocialProfile {
  userId: string;
  friends: string[]; // User IDs
  pendingFriends: string[]; // Pending friend requests
  communities: string[]; // Community IDs
  blockedUsers: string[];
  privacySettings: {
    showProfile: boolean;
    showStats: boolean;
    allowChallenges: boolean;
    showInLeaderboards: boolean;
  };
}

// Типи для рекомендацій
export type RecommendationType =
  | 'continue-practice'
  | 'next-logical'
  | 'weakness'
  | 'review-scheduled';

export interface Recommendation {
  id: string;
  type: RecommendationType;
  /** Theme id for navigation (practice tracks, theme pages) */
  themeId?: string;
  nodeId: string; // TopicNode ID or theme root id
  difficulty?: Difficulty;
  /** 0-based practice stage index */
  stageIndex?: number;
  title: string;
  description: string;
  priority: number; // 1-10, вище = пріоритетніше
  estimatedTime?: number; // у хвилинах
  reason: string; // Чому ця рекомендація
  masteryBefore?: number; // Поточний рівень знань
  targetMastery?: number; // Цільовий рівень
}
