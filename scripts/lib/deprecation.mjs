/**
 * Deprecation warning for legacy content scripts (Phase 4 WS10, spec §9).
 * Reads `scripts/ai/deprecation-matrix.json` — the same table `npm run ai --
 * scripts` prints — and tells the operator what replaces the script they just
 * ran. Printed to stderr so piped JSON output stays clean. The script keeps
 * working during the compatibility period; set
 * BIBLEGAMES_SILENCE_DEPRECATION=1 to mute the banner in automation.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MATRIX = path.join(SCRIPTS_DIR, 'ai', 'deprecation-matrix.json');

export function warnDeprecated(moduleUrl) {
  if (process.env.BIBLEGAMES_SILENCE_DEPRECATION === '1') return;
  let matrix;
  try {
    matrix = JSON.parse(fs.readFileSync(MATRIX, 'utf8'));
  } catch {
    return;
  }
  const file = path.relative(SCRIPTS_DIR, fileURLToPath(moduleUrl)).split(path.sep).join('/');
  const entry = matrix.scripts.find((s) => s.file === file);
  if (!entry || entry.status === 'read-only') return;
  const d = matrix.defaults;
  const lines = [
    `⚠  ${file} — ${entry.status === 'deprecated' ? 'ЗАСТАРІЛО' : 'заміни ще немає'} (Phase 4 §9)`,
    `   Пише: ${entry.writes}`,
    `   Замість цього: ${entry.replacement ?? '—'}`,
    `   Працює до: ${d.compatibilityUntil}; видалення: ${d.removalTarget}; відповідальний: ${d.owner}`,
    '   Цей скрипт обходить ревʼю Content Studio — нові зміни робіть через `npm run ai` або Студію.',
  ];
  process.stderr.write(`\n${lines.join('\n')}\n\n`);
}
