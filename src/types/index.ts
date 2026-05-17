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
