/**
 * The legacy question corpus, loaded once for every content CLI task (Phase 2
 * §14 importer, Phase 4 WS10 audit/waves). Sources, deduped by question id
 * (later source wins, same rule the Phase 2 importer always used):
 *   1. embedded `ALL_QUESTIONS` (bundled into the client)
 *   2. `data/question-db/<theme>.json` (served by the API's question pool)
 */
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_QUESTIONS } from '../../src/data/questions';
import type { Question } from '../../src/types';
import type { LegacyItem } from '../../server/domains/content/legacyAudit';
import type { RawQuestionInput } from '../../server/domains/content/validation';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DB_DIR = join(ROOT, 'data/question-db');

export function loadRootEnv(): void {
  const envPath = join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let value = t.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

export function toRaw(q: Question): RawQuestionInput {
  return {
    id: q.id,
    themeId: q.themeId,
    difficulty: q.difficulty,
    text: q.text,
    options: q.options,
    correctIndex: q.correctIndex,
    explanationShort: q.explanationShort ?? null,
    explanationDeep: q.explanationDeep ?? null,
    reference: q.reference ?? null,
    topicNodeId: q.topicNodeId ?? null,
    topicPath: q.topicPath ?? null,
    tags: q.tags ?? null,
    source: q.sourceQuality === 'ai-draft' || q.createdAt ? 'ai' : 'embedded',
  };
}

export interface LegacyCorpus {
  items: LegacyItem[];
  /** Bytes per source file (§12.1 "bundle size"). */
  sourceBytes: Record<string, number>;
}

export function loadLegacyCorpus(): LegacyCorpus {
  const byId = new Map<string, LegacyItem>();
  const sourceBytes: Record<string, number> = {};
  for (const q of ALL_QUESTIONS) if (q?.id) byId.set(q.id, { raw: toRaw(q), source: 'embedded' });
  for (const f of ['src/data/questions.ts', 'src/data/questions-extra.ts']) {
    const p = join(ROOT, f);
    if (fs.existsSync(p)) sourceBytes.embedded = (sourceBytes.embedded ?? 0) + fs.statSync(p).size;
  }
  if (fs.existsSync(DB_DIR)) {
    for (const file of fs.readdirSync(DB_DIR)) {
      if (!file.endsWith('.json')) continue;
      const source = `question-db/${file}`;
      const path = join(DB_DIR, file);
      sourceBytes[source] = fs.statSync(path).size;
      const themeId = file.replace(/\.json$/, '');
      try {
        const list = JSON.parse(fs.readFileSync(path, 'utf8')) as Question[];
        if (Array.isArray(list)) {
          for (const q of list) {
            if (q?.id) byId.set(q.id, { raw: toRaw({ ...q, themeId: q.themeId || themeId }), source });
          }
        }
      } catch {
        console.warn(`  skipped unreadable ${file}`);
      }
    }
  }
  return { items: [...byId.values()], sourceBytes };
}

/** Topic-node ids with a configured practice pool. */
export function loadPracticeNodeIds(): string[] {
  const p = join(ROOT, 'data/practice-stage-config.json');
  if (!fs.existsSync(p)) return [];
  const config = JSON.parse(fs.readFileSync(p, 'utf8')) as { nodes?: Record<string, unknown> };
  return Object.keys(config.nodes ?? {});
}

/** Every node id in the topic trees — the source `migrate:map-learning-content` builds learning plans from. */
export function loadLearningNodeIds(): string[] {
  const dir = join(ROOT, 'data/topics-db');
  if (!fs.existsSync(dir)) return [];
  const ids: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const n = node as { id?: unknown; children?: unknown };
    if (typeof n.id === 'string') ids.push(n.id);
    if (Array.isArray(n.children)) n.children.forEach(walk);
  };
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    try {
      walk(JSON.parse(fs.readFileSync(join(dir, file), 'utf8')));
    } catch {
      /* unreadable tree — the audit simply has fewer learning nodes */
    }
  }
  return ids;
}
