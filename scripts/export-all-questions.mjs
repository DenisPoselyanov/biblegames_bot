#!/usr/bin/env node
/** Експорт усіх питань (embedded + question-db) як JSON для AI Launcher V3. */
import { ALL_QUESTIONS } from '../src/data/questions.ts';
import { loadAllDbQuestions } from './lib/question-db.mjs';

const byId = new Map();
for (const q of ALL_QUESTIONS) {
  byId.set(q.id, { ...q, _source: 'embedded' });
}
for (const q of loadAllDbQuestions()) {
  byId.set(q.id, { ...q, _source: 'db' });
}
process.stdout.write(JSON.stringify([...byId.values()]));
