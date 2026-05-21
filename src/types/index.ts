export type Difficulty = 'beginner' | 'easy' | 'medium' | 'hard' | 'expert';

export interface Theme {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
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
}

export interface CompletedLevel {
  themeId: string;
  difficulty: Difficulty;
  score: number;
  maxScore: number;
  completedAt: string;
}

export interface PlayerProfile {
  userId: string;
  displayName: string;
  totalPoints: number;
  themePoints: Record<string, number>;
  completedLevels: CompletedLevel[];
  survivalHighScore: number;
  millionaireWins: number;
  millionaireMaxLevel: number;
  unlockedThemes: string[];
  activeTheme: string;
  achievements: string[];
  avatar: string;
  coins: number;
  unlockedAvatars: string[];
  streakDays: number;
  lastActiveAt: string | null;
  studyMastery: Record<string, MasteryState>;
}

export interface MasteryState {
  mastery: number;
  confidence: number;
  lastReviewedAt: string | null;
  errorTags: string[];
  correctStreak: number;
  wrongCount: number;
  totalAnswers: number;
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

export type StudyMode = 'practice' | 'review' | 'sprint';

export interface StudySession {
  id: string;
  userId: string;
  mode: StudyMode;
  subthemeId: string;
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
  'beginner',
  'easy',
  'medium',
  'hard',
  'expert',
];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: 'Початковий',
  easy: 'Легкий',
  medium: 'Середній',
  hard: 'Складний',
  expert: 'Експерт',
};

export const DIFFICULTY_POINTS: Record<Difficulty, number> = {
  beginner: 5,
  easy: 15,
  medium: 30,
  hard: 60,
  expert: 100,
};

export const QUESTIONS_PER_LEVEL = 7;

export const DIFFICULTY_ORDER: Record<Difficulty, number> = {
  beginner: 0,
  easy: 1,
  medium: 2,
  hard: 3,
  expert: 4,
};

export function isValidDifficulty(value: string): value is Difficulty {
  return DIFFICULTIES.includes(value as Difficulty);
}

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

export interface QualityIssue {
  type: 'duplicate' | 'ambiguous' | 'unclear_reference' | 'wrong_difficulty' | 'typo' | 'theological_error';
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
