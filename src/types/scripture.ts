import type { BollsTranslation } from '../lib/bollsConstants';

export interface ScriptureVerse {
  verse: number;
  text: string;
}

export interface ScripturePassage {
  reference: string;
  translation: BollsTranslation;
  translationLabel: string;
  bookId: number;
  chapter: number;
  verses: ScriptureVerse[];
  readerUrl: string;
  cached?: boolean;
  parseError?: string;
}

export interface DailyScripture {
  translation: BollsTranslation;
  translationLabel: string;
  bookId: number;
  chapter: number;
  verse: number;
  reference: string;
  text: string;
  readerUrl: string;
  date: string;
}
