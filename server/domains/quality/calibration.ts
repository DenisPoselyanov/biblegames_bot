/**
 * AI reviewer calibration (content quality gate, WS11c): how well the AI's
 * verdicts agree with the owner's golden labels, and whether that is good
 * enough to run it over the whole bank.
 *
 * Only pairs on the same body count — a golden label and an AI verdict made
 * against different content hashes compare two different questions.
 *
 * The number that matters most is reject recall: a reviewer that lets a
 * hallucinated question through is worse than one that flags a good question
 * for a human to look at. Agreement on the verdict is the second gate.
 */
import {
  ASSESSMENT_CRITERIA,
  ASSESSMENT_VERDICTS,
  type AssessmentCriterion,
  type AssessmentVerdict,
  type CriterionValue,
} from '../../../src/lib/contentAssessment';
import type { QuestionAssessment } from './assessment';

/** Tune with the owner. A full run is allowed only when every gate holds. */
export const CALIBRATION_THRESHOLDS = {
  /** Enough labels to mean anything. */
  minPairs: 100,
  /** Of the questions the owner rejected, the AI must reject (at least) this share. */
  rejectRecall: 0.9,
  /** Same verdict as the owner. */
  verdictAgreement: 0.75,
} as const;

export interface VerdictScore {
  /** How many the owner gave this verdict. */
  golden: number;
  /** How many the AI gave this verdict. */
  ai: number;
  both: number;
  /** both / ai — `null` when the AI never said it. */
  precision: number | null;
  /** both / golden — `null` when the owner never said it. */
  recall: number | null;
}

export interface CriterionScore {
  /** Pairs where both gave a definite value (pass/fail), and how many of those agree. */
  decided: number;
  agree: number;
  agreement: number | null;
  /** Of the owner's `fail`s, how many the AI also failed (or flagged `unsure`). */
  goldenFails: number;
  caught: number;
  failRecall: number | null;
}

export interface CalibrationDisagreement {
  questionId: string;
  text: string;
  golden: AssessmentVerdict;
  ai: AssessmentVerdict;
  aiConfidence: number | null;
  /** Criteria where the two differ: [owner, AI]. */
  criteria: Partial<Record<AssessmentCriterion, [CriterionValue, CriterionValue]>>;
  goldenNotes: string | null;
  aiNotes: string | null;
}

export interface CalibrationReport {
  goldenLabels: number;
  pairs: number;
  /** Golden labels with no AI verdict on the same body yet. */
  missingAi: number;
  verdictAgreement: number | null;
  /** Owner said anything but pass → AI said anything but pass. */
  flagRecall: number | null;
  /** golden verdict → AI verdict → count. */
  confusion: Record<AssessmentVerdict, Record<AssessmentVerdict, number>>;
  byVerdict: Record<AssessmentVerdict, VerdictScore>;
  byCriterion: Record<AssessmentCriterion, CriterionScore>;
  /** Mean AI confidence when it agreed vs. when it didn't — a usable confidence is higher on agreement. */
  confidence: { agreed: number | null; disagreed: number | null };
  trusted: boolean;
  /** Why not trusted (empty when trusted). */
  gateFailures: string[];
  thresholds: typeof CALIBRATION_THRESHOLDS;
  /** Worst first: owner rejected but AI passed, then by distance between verdicts. */
  disagreements: CalibrationDisagreement[];
}

const ratio = (n: number, d: number): number | null => (d > 0 ? n / d : null);
const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const SEVERITY: Record<AssessmentVerdict, number> = { pass: 0, reclassify: 1, repair: 2, reject: 3 };

export function calibrate(
  golden: readonly QuestionAssessment[],
  ai: readonly QuestionAssessment[],
  thresholds: typeof CALIBRATION_THRESHOLDS = CALIBRATION_THRESHOLDS,
): CalibrationReport {
  const aiByKey = new Map<string, QuestionAssessment>();
  for (const a of ai) aiByKey.set(`${a.questionId}:${a.contentHash}`, a);

  const confusion = Object.fromEntries(
    ASSESSMENT_VERDICTS.map((g) => [g, Object.fromEntries(ASSESSMENT_VERDICTS.map((v) => [v, 0]))]),
  ) as CalibrationReport['confusion'];
  const byCriterion = Object.fromEntries(
    ASSESSMENT_CRITERIA.map((c) => [c, { decided: 0, agree: 0, agreement: null, goldenFails: 0, caught: 0, failRecall: null }]),
  ) as Record<AssessmentCriterion, CriterionScore>;

  let pairs = 0;
  let agree = 0;
  let flagged = 0;
  let flaggedCaught = 0;
  const confAgreed: number[] = [];
  const confDisagreed: number[] = [];
  const disagreements: CalibrationDisagreement[] = [];

  for (const g of golden) {
    const a = aiByKey.get(`${g.questionId}:${g.contentHash}`);
    if (!a) continue;
    pairs += 1;
    confusion[g.verdict][a.verdict] += 1;
    const same = g.verdict === a.verdict;
    if (same) agree += 1;
    if (a.confidence != null) (same ? confAgreed : confDisagreed).push(a.confidence);
    if (g.verdict !== 'pass') {
      flagged += 1;
      if (a.verdict !== 'pass') flaggedCaught += 1;
    }

    const diff: CalibrationDisagreement['criteria'] = {};
    for (const c of ASSESSMENT_CRITERIA) {
      const gv = g.criteria[c];
      const av = a.criteria[c];
      const s = byCriterion[c];
      if (gv !== 'unsure' && av !== 'unsure') {
        s.decided += 1;
        if (gv === av) s.agree += 1;
      }
      if (gv === 'fail') {
        s.goldenFails += 1;
        if (av !== 'pass') s.caught += 1;
      }
      if (gv !== av) diff[c] = [gv, av];
    }
    if (!same) {
      disagreements.push({
        questionId: g.questionId,
        text: g.subject.text,
        golden: g.verdict,
        ai: a.verdict,
        aiConfidence: a.confidence,
        criteria: diff,
        goldenNotes: g.notes,
        aiNotes: a.notes,
      });
    }
  }

  for (const s of Object.values(byCriterion)) {
    s.agreement = ratio(s.agree, s.decided);
    s.failRecall = ratio(s.caught, s.goldenFails);
  }

  const byVerdict = Object.fromEntries(
    ASSESSMENT_VERDICTS.map((v) => {
      const goldenN = ASSESSMENT_VERDICTS.reduce((n, x) => n + confusion[v][x], 0);
      const aiN = ASSESSMENT_VERDICTS.reduce((n, x) => n + confusion[x][v], 0);
      const both = confusion[v][v];
      return [v, { golden: goldenN, ai: aiN, both, precision: ratio(both, aiN), recall: ratio(both, goldenN) }];
    }),
  ) as Record<AssessmentVerdict, VerdictScore>;

  const verdictAgreement = ratio(agree, pairs);
  const rejectRecall = byVerdict.reject.recall;
  const gateFailures: string[] = [];
  if (pairs < thresholds.minPairs) gateFailures.push(`замало пар: ${pairs} з потрібних ${thresholds.minPairs}`);
  if (rejectRecall === null) gateFailures.push('в еталоні немає жодного «Відхилити» — повноту відхилень не виміряти');
  else if (rejectRecall < thresholds.rejectRecall) {
    gateFailures.push(`AI ловить ${(rejectRecall * 100).toFixed(0)}% відхилень, потрібно ≥ ${thresholds.rejectRecall * 100}%`);
  }
  if (verdictAgreement !== null && verdictAgreement < thresholds.verdictAgreement) {
    gateFailures.push(
      `збіг вердиктів ${(verdictAgreement * 100).toFixed(0)}%, потрібно ≥ ${thresholds.verdictAgreement * 100}%`,
    );
  }

  disagreements.sort((x, y) => {
    const missedX = x.golden === 'reject' && x.ai === 'pass' ? 1 : 0;
    const missedY = y.golden === 'reject' && y.ai === 'pass' ? 1 : 0;
    if (missedX !== missedY) return missedY - missedX;
    const dx = SEVERITY[x.golden] - SEVERITY[x.ai];
    const dy = SEVERITY[y.golden] - SEVERITY[y.ai];
    return dy - dx || x.questionId.localeCompare(y.questionId);
  });

  return {
    goldenLabels: golden.length,
    pairs,
    missingAi: golden.length - pairs,
    verdictAgreement,
    flagRecall: ratio(flaggedCaught, flagged),
    confusion,
    byVerdict,
    byCriterion,
    confidence: { agreed: mean(confAgreed), disagreed: mean(confDisagreed) },
    trusted: gateFailures.length === 0,
    gateFailures,
    thresholds,
    disagreements,
  };
}
