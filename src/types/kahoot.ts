import type { Difficulty } from './index';

export type KahootPhase = 'lobby' | 'think' | 'question' | 'reveal' | 'leaderboard' | 'finished';

export type KahootFlowMode = 'auto' | 'manual';
export type KahootScoringMode = 'classic' | 'simple';

export interface KahootPlayer {
  id: string;
  name: string;
  score: number;
  streak: number;
  lastPoints?: number;
  lastCorrect?: boolean;
  rank?: number;
  customField?: string;
  isHost?: boolean;
}

export interface KahootQuestionView {
  id: string;
  text: string;
  options: string[];
  themeId: string;
  index: number;
  total: number;
}

export interface KahootRoomSettings {
  themeIds: string[];
  questionCount: number;
  timePerQuestion: number;
  difficulty: Difficulty;
  playlistId?: string;
  questionIds?: string[];
  flowMode: KahootFlowMode;
  scoringMode: KahootScoringMode;
  thinkTimeSec: number;
  hostParticipates: boolean;
  roomTitle?: string;
  customFieldLabel?: string;
}

export interface KahootRoomState {
  code: string;
  phase: KahootPhase;
  hostId: string;
  settings: KahootRoomSettings;
  players: KahootPlayer[];
  question?: KahootQuestionView;
  questionEndsAt?: number;
  thinkEndsAt?: number;
  correctIndex?: number;
  reference?: string;
  answeredCount: number;
  totalActivePlayers: number;
  answerCounts?: number[];
  playerRanks?: Record<string, number>;
  displayOnly?: boolean;
}

export interface KahootCreatePayload {
  hostName: string;
  settings: KahootRoomSettings;
  hostTelegramId?: string;
}

export interface KahootJoinPayload {
  code: string;
  playerName: string;
  customField?: string;
}

export interface KahootAnswerPayload {
  optionIndex: number;
}

export interface KahootSessionRecord {
  id: string;
  code: string;
  finishedAt: string;
  hostTelegramId?: string;
  settings: KahootRoomSettings;
  players: Array<{
    name: string;
    score: number;
    rank: number;
    customField?: string;
  }>;
  questionCount: number;
}

export const KAHOOT_SETTINGS_DEFAULTS: Pick<
  KahootRoomSettings,
  'flowMode' | 'scoringMode' | 'thinkTimeSec' | 'hostParticipates'
> = {
  flowMode: 'auto',
  scoringMode: 'classic',
  thinkTimeSec: 0,
  hostParticipates: false,
};

export function normalizeKahootSettings(settings: Partial<KahootRoomSettings> & Pick<KahootRoomSettings, 'themeIds' | 'questionCount' | 'timePerQuestion' | 'difficulty'>): KahootRoomSettings {
  return {
    themeIds: settings.themeIds ?? [],
    questionCount: settings.questionCount,
    timePerQuestion: settings.timePerQuestion,
    difficulty: settings.difficulty,
    playlistId: settings.playlistId,
    questionIds: settings.questionIds,
    flowMode: settings.flowMode ?? KAHOOT_SETTINGS_DEFAULTS.flowMode,
    scoringMode: settings.scoringMode ?? KAHOOT_SETTINGS_DEFAULTS.scoringMode,
    thinkTimeSec: Math.min(30, Math.max(0, settings.thinkTimeSec ?? 0)),
    hostParticipates: settings.hostParticipates ?? KAHOOT_SETTINGS_DEFAULTS.hostParticipates,
    roomTitle: settings.roomTitle?.trim() || undefined,
    customFieldLabel: settings.customFieldLabel?.trim() || undefined,
  };
}
