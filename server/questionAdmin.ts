import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { Question } from '../src/types/index';
import { ALL_QUESTIONS } from '../src/data/questions';
import {
  applyDiskMutations,
  loadExclusionsFromDisk,
  loadOverridesFromDisk,
  normalizeCorrectIndex,
  notifyQuestionPoolChanged,
  saveExclusionsToDisk,
  saveOverridesToDisk,
} from './questionMutations';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = join(__dirname, '../data/question-db');

type QuestionSource = 'json' | 'embedded';

function findInJsonFiles(questionId: string): { themeId: string; filePath: string } | null {
  if (!fs.existsSync(DB_DIR)) return null;

  for (const file of fs.readdirSync(DB_DIR)) {
    if (!file.endsWith('.json')) continue;
    const filePath = join(DB_DIR, file);
    try {
      const list = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Question[];
      if (!Array.isArray(list)) continue;
      if (list.some((q) => q.id === questionId)) {
        return { themeId: file.replace(/\.json$/, ''), filePath };
      }
    } catch {
      // skip broken file
    }
  }
  return null;
}

function readJsonList(filePath: string): Question[] {
  try {
    const list = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Question[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeJsonList(filePath: string, list: Question[]): void {
  fs.writeFileSync(filePath, `${JSON.stringify(list, null, 2)}\n`, 'utf8');
}

function isEmbeddedQuestion(questionId: string): boolean {
  return ALL_QUESTIONS.some((q) => q.id === questionId);
}

export function locateQuestion(questionId: string): { source: QuestionSource; themeId?: string; filePath?: string } | null {
  const jsonHit = findInJsonFiles(questionId);
  if (jsonHit) {
    return { source: 'json', themeId: jsonHit.themeId, filePath: jsonHit.filePath };
  }
  if (isEmbeddedQuestion(questionId)) {
    const embedded = ALL_QUESTIONS.find((q) => q.id === questionId);
    return { source: 'embedded', themeId: embedded?.themeId };
  }
  return null;
}

export function deleteQuestionPermanently(questionId: string): { source: QuestionSource } {
  const location = locateQuestion(questionId);
  if (!location) {
    throw new Error('question_not_found');
  }

  if (location.source === 'json' && location.filePath) {
    const list = readJsonList(location.filePath);
    const next = list.filter((q) => q.id !== questionId);
    if (next.length === list.length) {
      throw new Error('question_not_found');
    }
    writeJsonList(location.filePath, next);
  } else {
    const exclusions = loadExclusionsFromDisk();
    if (!exclusions.includes(questionId)) {
      saveExclusionsToDisk([...exclusions, questionId]);
    }
  }

  const overrides = loadOverridesFromDisk();
  if (overrides[questionId]) {
    delete overrides[questionId];
    saveOverridesToDisk(overrides);
  }

  notifyQuestionPoolChanged();
  return { source: location.source };
}

export function updateQuestionPermanently(questionId: string, patch: Partial<Question>): Question {
  const location = locateQuestion(questionId);
  if (!location) {
    throw new Error('question_not_found');
  }

  const base =
    location.source === 'json' && location.filePath
      ? (readJsonList(location.filePath).find((q) => q.id === questionId) ?? null)
      : (ALL_QUESTIONS.find((q) => q.id === questionId) ?? null);

  if (!base) {
    throw new Error('question_not_found');
  }

  const updated: Question = {
    ...base,
    ...patch,
    id: questionId,
    themeId: patch.themeId ?? base.themeId,
    options: patch.options ?? base.options,
    correctIndex: normalizeCorrectIndex(patch.correctIndex ?? base.correctIndex),
  };

  if (location.source === 'json' && location.filePath) {
    const list = readJsonList(location.filePath);
    writeJsonList(
      location.filePath,
      list.map((q) => (q.id === questionId ? updated : q)),
    );
  } else {
    const overrides = loadOverridesFromDisk();
    overrides[questionId] = updated;
    saveOverridesToDisk(overrides);

    const exclusions = loadExclusionsFromDisk();
    if (exclusions.includes(questionId)) {
      saveExclusionsToDisk(exclusions.filter((id) => id !== questionId));
    }
  }

  notifyQuestionPoolChanged();
  return updated;
}

export { applyDiskMutations, loadExclusionsFromDisk, loadOverridesFromDisk };
