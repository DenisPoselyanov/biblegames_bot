/**
 * Content quality gate tasks for `npm run ai -- <task>` (WS11c/d, layers 2–3).
 * Same rules as every CLI task: dry-run by default, `--apply` to write,
 * `--json` for machine output. Kept apart from `cli.ts` so the gate's tasks
 * read as one unit.
 */
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { IMPORTABLE_CLASSES, type LegacyAuditReport, type LegacyItem } from '../../server/domains/content/legacyAudit';
import { validateQuestion } from '../../server/domains/content/validation';
import type { RevisionDraft } from '../../server/domains/content/types';
import { subjectFromDraft } from '../../server/domains/quality/assessmentSubject';
import {
  buildGoldenSample,
  GOLDEN_STRATUM_LABELS,
  type GoldenCandidate,
  type GoldenSample,
} from '../../server/domains/quality/goldenSample';
import { ROOT } from '../content/legacyCorpus';

export const GOLDEN_SAMPLE_PATH = join(ROOT, 'data/quality/golden-sample.json');

export interface QualityTaskContext {
  apply: boolean;
  opt: (name: string) => string | undefined;
  flag: (name: string) => boolean;
  out: (human: string, machine: unknown) => void;
  fail: (message: string) => never;
  runAudit: () => { corpus: { items: LegacyItem[] }; report: LegacyAuditReport };
}

type Task = { summary: string; run: () => Promise<void> };

/** Importable legacy items as assessment candidates (subject + deterministic finding kinds). */
export function legacyCandidates(ctx: QualityTaskContext): GoldenCandidate[] {
  const { corpus, report } = ctx.runAudit();
  const byId = new Map(report.items.map((i) => [i.id, i]));
  const out: GoldenCandidate[] = [];
  for (const item of corpus.items) {
    const audit = byId.get(item.raw.id);
    if (!audit || !IMPORTABLE_CLASSES.has(audit.classification)) continue;
    const validation = validateQuestion(item.raw);
    if (!validation.ok) continue;
    out.push({ subject: subjectFromDraft(validation.draft as RevisionDraft), findings: audit.findings });
  }
  return out;
}

export function readGoldenSample(path = GOLDEN_SAMPLE_PATH): GoldenSample | null {
  if (!fs.existsSync(path)) return null;
  return JSON.parse(fs.readFileSync(path, 'utf8')) as GoldenSample;
}

export function createQualityTasks(ctx: QualityTaskContext): Record<string, Task> {
  return {
    'golden-sample': {
      summary: 'draw the ~200-question golden set for owner labelling → data/quality/golden-sample.json ([--size 200] [--seed s] [--apply])',
      async run() {
        const existing = readGoldenSample();
        if (existing && ctx.apply && !ctx.flag('force')) {
          ctx.fail(`${GOLDEN_SAMPLE_PATH} already exists (${existing.size} items). Labels are bound to it — pass --force to redraw.`);
        }
        const sample = buildGoldenSample(legacyCandidates(ctx), {
          size: Number(ctx.opt('size') ?? 200),
          seed: ctx.opt('seed'),
        });
        const lines = Object.entries(sample.byStratum).map(
          ([s, n]) => `  ${GOLDEN_STRATUM_LABELS[s as keyof typeof GOLDEN_STRATUM_LABELS].padEnd(24)} ${n}`,
        );
        const human = [`Golden sample: ${sample.size} items (seed ${sample.seed})`, ...lines].join('\n');
        if (!ctx.apply) {
          ctx.out(`[dry] ${human}\nPass --apply to write ${GOLDEN_SAMPLE_PATH}.`, { dryRun: true, ...sample, items: sample.items.length });
          return;
        }
        fs.mkdirSync(dirname(GOLDEN_SAMPLE_PATH), { recursive: true });
        fs.writeFileSync(GOLDEN_SAMPLE_PATH, `${JSON.stringify(sample, null, 2)}\n`);
        ctx.out(`${human}\n→ ${GOLDEN_SAMPLE_PATH}`, { path: GOLDEN_SAMPLE_PATH, byStratum: sample.byStratum, size: sample.size });
      },
    },
  };
}
