/**
 * Golden-set sampling (content quality gate, WS11c). The owner hand-labels
 * ~200 questions; the AI reviewer is calibrated against those labels before it
 * is trusted on the rest of the bank.
 *
 * A uniform sample would be ~85% clean items and teach little about the
 * failure modes, so the sample is stratified by what the deterministic checks
 * already suspect (theme/book mismatch, reference problems, language, other
 * findings, clean), and inside each stratum spread round-robin across levels
 * and themes. Deterministic for a given seed, so the file can be regenerated
 * and reviewed in a diff.
 */
import type { AssessmentSubject } from '../../../src/lib/contentAssessment';

export const GOLDEN_STRATA = ['canon_mismatch', 'reference', 'language', 'other_findings', 'clean'] as const;
export type GoldenStratum = (typeof GOLDEN_STRATA)[number];

/** Share of the sample per stratum — over-samples the suspicious buckets on purpose. */
export const GOLDEN_ALLOCATION: Record<GoldenStratum, number> = {
  canon_mismatch: 0.3,
  reference: 0.15,
  language: 0.05,
  other_findings: 0.15,
  clean: 0.35,
};

export const GOLDEN_STRATUM_LABELS: Record<GoldenStratum, string> = {
  canon_mismatch: 'Книга поза темою',
  reference: 'Проблема з посиланням',
  language: 'Мова',
  other_findings: 'Інші зауваження',
  clean: 'Без зауважень',
};

export interface GoldenCandidate {
  subject: AssessmentSubject;
  /** Finding kinds from the deterministic checks. */
  findings: string[];
}

export interface GoldenSampleItem extends GoldenCandidate {
  stratum: GoldenStratum;
}

export interface GoldenSample {
  version: 1;
  seed: string;
  size: number;
  generatedAt: string;
  byStratum: Record<GoldenStratum, number>;
  items: GoldenSampleItem[];
}

/** Kinds that don't say anything about the content (info/heuristic noise) — ignored when bucketing. */
const NOISE = new Set([
  'missing_deep_explanation',
  'option_length_imbalance',
  'explanation_length_for_level',
  'deep_explanation_length_for_level',
  'validation_run',
]);

export function stratumOf(findings: readonly string[]): GoldenStratum {
  const kinds = findings.filter((k) => !NOISE.has(k));
  if (kinds.includes('theme_canon_mismatch')) return 'canon_mismatch';
  if (kinds.some((k) => k === 'missing_reference' || k === 'reference_unparsed' || k === 'reference_ambiguous')) {
    return 'reference';
  }
  if (kinds.includes('mixed_language')) return 'language';
  if (kinds.length > 0) return 'other_findings';
  return 'clean';
}

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Stable pseudo-random order: sort by a seeded hash of the id. */
function seededOrder<T>(items: readonly T[], key: (t: T) => string, seed: string): T[] {
  return [...items].sort((a, b) => hash32(`${seed}:${key(a)}`) - hash32(`${seed}:${key(b)}`) || (key(a) < key(b) ? -1 : 1));
}

/** Round-robin across levels, then themes within a level, so no level or theme dominates a stratum. */
function spread(items: readonly GoldenCandidate[], take: number, seed: string): GoldenCandidate[] {
  const byLevel = new Map<string, Map<string, GoldenCandidate[]>>();
  for (const c of seededOrder(items, (x) => x.subject.questionId, seed)) {
    let themes = byLevel.get(c.subject.difficulty);
    if (!themes) byLevel.set(c.subject.difficulty, (themes = new Map()));
    let list = themes.get(c.subject.themeId);
    if (!list) themes.set(c.subject.themeId, (list = []));
    list.push(c);
  }
  const levels = seededOrder([...byLevel.keys()], (k) => k, seed);
  const themeOrder = new Map(levels.map((l) => [l, seededOrder([...byLevel.get(l)!.keys()], (k) => k, seed)]));
  const cursor = new Map<string, number>();
  const out: GoldenCandidate[] = [];
  while (out.length < take) {
    let progressed = false;
    for (const level of levels) {
      if (out.length >= take) break;
      const themes = themeOrder.get(level)!;
      for (let tries = 0; tries < themes.length; tries++) {
        const i = (cursor.get(level) ?? 0) % themes.length;
        cursor.set(level, i + 1);
        const next = byLevel.get(level)!.get(themes[i])!.shift();
        if (next) {
          out.push(next);
          progressed = true;
          break;
        }
      }
    }
    if (!progressed) break;
  }
  return out;
}

export function buildGoldenSample(
  candidates: readonly GoldenCandidate[],
  options: { size?: number; seed?: string; now?: () => Date } = {},
): GoldenSample {
  const size = options.size ?? 200;
  const seed = options.seed ?? 'golden-2026-09';
  const byStratum = new Map<GoldenStratum, GoldenCandidate[]>(GOLDEN_STRATA.map((s) => [s, []]));
  for (const c of candidates) byStratum.get(stratumOf(c.findings))!.push(c);

  // Target per stratum; a short stratum hands its leftover to the others in order.
  const target = new Map<GoldenStratum, number>();
  let assigned = 0;
  for (const s of GOLDEN_STRATA) {
    const want = Math.round(size * GOLDEN_ALLOCATION[s]);
    const got = Math.min(want, byStratum.get(s)!.length);
    target.set(s, got);
    assigned += got;
  }
  for (const s of GOLDEN_STRATA) {
    if (assigned >= size) break;
    const room = byStratum.get(s)!.length - target.get(s)!;
    const extra = Math.min(room, size - assigned);
    target.set(s, target.get(s)! + extra);
    assigned += extra;
  }

  const items: GoldenSampleItem[] = [];
  const counts = Object.fromEntries(GOLDEN_STRATA.map((s) => [s, 0])) as Record<GoldenStratum, number>;
  for (const s of GOLDEN_STRATA) {
    for (const c of spread(byStratum.get(s)!, target.get(s)!, `${seed}:${s}`)) {
      items.push({ ...c, stratum: s });
      counts[s] += 1;
    }
  }
  return {
    version: 1,
    seed,
    size: items.length,
    generatedAt: (options.now ?? (() => new Date()))().toISOString(),
    byStratum: counts,
    // Mixed order: labelling a block of "suspected" items in a row would anchor the labeller.
    items: seededOrder(items, (x) => x.subject.questionId, `${seed}:order`),
  };
}
