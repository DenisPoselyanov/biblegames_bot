/**
 * Перевірка полів reference у question-db через локальний API (або bolls напряму).
 * npm run scripture:audit
 * API_BASE=http://localhost:3001 npm run scripture:audit
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const QUESTION_DIR = path.join(ROOT, 'data', 'question-db');
const API_BASE = process.env.API_BASE || process.env.VITE_API_BASE_URL || 'http://localhost:3001';
const TRANSLATION = process.env.BOLLS_DEFAULT_TRANSLATION || 'UTT';
const DELAY_MS = Number(process.env.SCRIPTURE_AUDIT_DELAY_MS || 120);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function referenceStringsFromField(reference) {
  if (reference == null) return [];
  if (Array.isArray(reference)) {
    return reference.map((r) => String(r).trim()).filter(Boolean);
  }
  const s = String(reference).trim();
  if (!s) return [];
  return s.split(/[;|]/).map((part) => part.trim()).filter(Boolean);
}

function collectReferences() {
  const files = fs.readdirSync(QUESTION_DIR).filter((f) => f.endsWith('.json'));
  const items = [];
  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(QUESTION_DIR, file), 'utf8'));
    const list = Array.isArray(raw) ? raw : raw.questions ?? [];
    for (const q of list) {
      for (const reference of referenceStringsFromField(q.reference)) {
        items.push({ id: q.id, file, reference });
      }
    }
  }
  return items;
}

async function checkReference(reference) {
  const url = `${API_BASE}/api/scripture?${new URLSearchParams({ ref: reference, translation: TRANSLATION })}`;
  const res = await fetch(url);
  if (!res.ok) {
    let errorBody;
    try {
      errorBody = await res.json();
    } catch {
      errorBody = undefined;
    }
    return { status: 'http_error', code: res.status, error: errorBody?.error };
  }
  const data = await res.json();
  if (data.parseError === 'unparsed_reference') return { status: 'unparsed' };
  if (data.parseError === 'bolls_unavailable') return { status: 'bolls_error' };
  if (!data.verses?.length) return { status: 'empty' };
  return { status: 'ok', verses: data.verses.length };
}

async function main() {
  const items = collectReferences();
  const uniqueRefs = [...new Map(items.map((i) => [i.reference, i])).values()];
  console.log(`Перевірка ${uniqueRefs.length} унікальних посилань (${items.length} питань), переклад ${TRANSLATION}`);
  console.log(`API: ${API_BASE}`);

  const summary = { ok: 0, unparsed: 0, empty: 0, bolls_error: 0, http_error: 0 };
  let authHintShown = false;
  const failures = [];

  for (const item of uniqueRefs) {
    const result = await checkReference(item.reference);
    summary[result.status] = (summary[result.status] ?? 0) + 1;
    if (result.status !== 'ok') {
      failures.push({ reference: item.reference, ...result, sampleId: item.id, file: item.file });
    }
    if (!authHintShown && result.status === 'http_error' && result.code === 401) {
      authHintShown = true;
      console.warn(
        '\n⚠️ 401 на /api/scripture — перезапустіть backend (npm run server:dev) після оновлення server/index.ts.\n' +
          '   Ендпоінт Писання має бути публічним; старий процес або глобальний auth блокує аудит.\n',
      );
    }
    await sleep(DELAY_MS);
  }

  console.log('\nПідсумок:', summary);
  if (failures.length > 0) {
    console.log('\nПроблемні посилання (до 30):');
    for (const f of failures.slice(0, 30)) {
      console.log(`  [${f.status}] ${f.reference} (${f.file} / ${f.sampleId})`);
    }
    if (failures.length > 30) console.log(`  … ще ${failures.length - 30}`);
  }

  const outPath = path.join(ROOT, 'data', 'scripture-audit-report.json');
  fs.writeFileSync(outPath, JSON.stringify({ summary, failures, translation: TRANSLATION, at: new Date().toISOString() }, null, 2));
  console.log(`\nЗвіт: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
