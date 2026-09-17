import { createContext } from 'react';

export type ProtoTheme = 'dark' | 'light';

export interface PracticeResult {
  total: number;
  correct: number;
  xp: number;
  coins: number;
  durationSec: number;
  wrongIds: string[];
}

export interface ProtoState {
  theme: ProtoTheme;
  streak: number;
  xp: number;
  coins: number;
  level: number;
  lessonBlock: number;
  lessonDone: boolean;
  answeredToday: number;
  lastResult: PracticeResult | null;
}

export interface ProtoStore extends ProtoState {
  setTheme: (theme: ProtoTheme) => void;
  toggleTheme: () => void;
  setLessonBlock: (index: number) => void;
  completeLesson: () => void;
  finishPractice: (result: PracticeResult) => void;
  reset: () => void;
}

export const INITIAL_STATE: ProtoState = {
  theme: 'dark',
  streak: 7,
  xp: 1840,
  coins: 320,
  level: 6,
  lessonBlock: 0,
  lessonDone: false,
  answeredToday: 0,
  lastResult: null,
};

export const STORAGE_KEY = 'proto.design-v2.state';

export const ProtoContext = createContext<ProtoStore | null>(null);
