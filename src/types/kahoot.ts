import type { Difficulty } from './index';

export type KahootPhase = 'lobby' | 'question' | 'reveal' | 'finished';

export interface KahootPlayer {
  id: string;
  name: string;
  score: number;
  streak: number;
  lastPoints?: number;
  lastCorrect?: boolean;
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
}

export interface KahootRoomState {
  code: string;
  phase: KahootPhase;
  hostId: string;
  settings: KahootRoomSettings;
  players: KahootPlayer[];
  question?: KahootQuestionView;
  questionEndsAt?: number;
  correctIndex?: number;
  reference?: string;
  answeredCount: number;
}

export interface KahootCreatePayload {
  hostName: string;
  settings: KahootRoomSettings;
}

export interface KahootJoinPayload {
  code: string;
  playerName: string;
}

export interface KahootAnswerPayload {
  optionIndex: number;
}
