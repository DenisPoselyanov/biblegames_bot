import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DIFFICULTIES } from './themes-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DB_DIR = join(__dirname, '../../data/question-db');

function ensureDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

export function dbPath(themeId) {
  return join(DB_DIR, `${themeId}.json`);
}

export function loadThemeQuestions(themeId) {
  ensureDir();
  const path = dbPath(themeId);
  if (!fs.existsSync(path)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function saveThemeQuestions(themeId, questions) {
  ensureDir();
  fs.writeFileSync(dbPath(themeId), JSON.stringify(questions, null, 2), 'utf8');
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function dedupeQuestions(questions) {
  const seen = new Set();
  const result = [];

  for (const q of questions) {
    const key = `${q.themeId}|${q.difficulty}|${normalizeText(q.text)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(q);
  }

  return result;
}

export function makeQuestionId(themeId, difficulty, index) {
  return `${themeId}-${difficulty}-ai-${String(index).padStart(5, '0')}`;
}

export function normalizeAiQuestion(raw, themeId, difficulty, index) {
  if (!raw || typeof raw !== 'object') return null;

  const text = String(raw.text ?? '').trim();
  if (!text) return null;

  if (!Array.isArray(raw.options)) return null;
  const options = raw.options.map((o) => String(o ?? '').trim()).filter(Boolean);
  if (options.length !== 4) return null;

  // унікальні варіанти (без дублікатів)
  if (new Set(options.map((o) => o.toLowerCase())).size !== 4) return null;

  let correctIndex = typeof raw.correct === 'number' ? raw.correct : raw.correctIndex;
  if (typeof correctIndex !== 'number' || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
    correctIndex = 0;
  }

  const reference = (raw.ref || raw.reference || '').toString().trim();

  return {
    id: makeQuestionId(themeId, difficulty, index),
    themeId,
    difficulty,
    text,
    options,
    correctIndex,
    reference: reference || undefined,
    source: 'ai',
    createdAt: new Date().toISOString(),
  };
}

export function appendQuestions(themeId, newQuestions) {
  const existing = loadThemeQuestions(themeId);
  const merged = dedupeQuestions([...existing, ...newQuestions]);
  saveThemeQuestions(themeId, merged);
  return {
    before: existing.length,
    after: merged.length,
    added: merged.length - existing.length,
  };
}

export function getGlobalStats() {
  ensureDir();
  const stats = {};
  const files = fs.existsSync(DB_DIR)
    ? fs.readdirSync(DB_DIR).filter((f) => f.endsWith('.json'))
    : [];

  for (const file of files) {
    const themeId = file.replace('.json', '');
    const questions = loadThemeQuestions(themeId);
    stats[themeId] = { total: questions.length };

    for (const d of DIFFICULTIES) {
      stats[themeId][d] = questions.filter((q) => q.difficulty === d).length;
    }
  }

  return stats;
}

export function loadAllDbQuestions() {
  ensureDir();
  const all = [];
  for (const file of fs.readdirSync(DB_DIR).filter((f) => f.endsWith('.json'))) {
    all.push(...loadThemeQuestions(file.replace('.json', '')));
  }
  return all;
}
