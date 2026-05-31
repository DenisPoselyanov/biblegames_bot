/**
 * Rule-based аналіз якості пояснень до питань (без Ollama).
 */

const GENERIC_FILLER_PATTERNS = [
  /прив['']?язан[ео].*біблійн/i,
  /зверни увагу на правильну відповідь/i,
  /допомагають закріпити контекст/i,
  /не просто запам['']?ятати варіант/i,
  /це питання про/i,
];

const THEOLOGICAL_RED_FLAGS = [
  /ісус.*не.*син.*бог/i,
  /бог.*не.*існує/i,
  /біблія.*не.*істина/i,
];

const SHORT_MIN_LEN = 40;
const SHORT_MAX_LEN = 300;

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\sа-яґєії]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalizeText(text).split(' ').filter((w) => w.length > 2);
}

export function calculateTextSimilarity(text1, text2) {
  const words1 = tokenize(text1);
  const words2 = tokenize(text2);
  if (words1.length === 0 || words2.length === 0) return 0;
  const intersection = words1.filter((w) => words2.includes(w));
  const union = [...new Set([...words1, ...words2])];
  return intersection.length / union.length;
}

function referenceBookHint(reference) {
  if (reference == null) return '';
  const raw = Array.isArray(reference) ? reference.join(' ') : String(reference);
  const m = raw.match(/^([1-3]?\s?[А-ЯІЇЄҐA-Za-z.]+)/);
  return m ? normalizeText(m[1]) : normalizeText(raw).slice(0, 12);
}

export function getExplanationCoverage(question) {
  const short = String(question.explanationShort ?? '').trim();
  const deep = String(question.explanationDeep ?? '').trim();
  if (!short && !deep) return 'missing';
  if (!short && deep) return 'orphan_deep';
  if (short && !deep) return 'short_only';
  return 'complete';
}

function getCorrectAnswer(question) {
  const idx = question.correctIndex ?? 0;
  const opts = question.options ?? [];
  return String(opts[idx] ?? '').trim();
}

function explanationCombined(question) {
  const short = String(question.explanationShort ?? '').trim();
  const deep = String(question.explanationDeep ?? '').trim();
  return [short, deep].filter(Boolean).join(' ');
}

/**
 * @param {object} question
 * @returns {{ coverage: string, issues: Array<{type: string, severity: string, message: string}>, heuristicScore: number, coverageScore: number, explanationShortPreview: string }}
 */
export function analyzeExplanation(question) {
  const issues = [];
  const coverage = getExplanationCoverage(question);
  const combined = explanationCombined(question);
  const short = String(question.explanationShort ?? '').trim();
  const correct = getCorrectAnswer(question);
  const questionText = String(question.text ?? '').trim();

  if (coverage === 'missing') {
    issues.push({
      type: 'missing_explanation',
      severity: 'high',
      message: 'Відсутнє пояснення (short і deep)',
    });
  }

  if (coverage === 'orphan_deep') {
    issues.push({
      type: 'orphan_deep',
      severity: 'medium',
      message: 'Є детальне пояснення без короткого',
    });
  }

  if (short) {
    if (short.length < SHORT_MIN_LEN) {
      issues.push({
        type: 'too_short',
        severity: 'medium',
        message: `Коротке пояснення занадто коротке (${short.length} < ${SHORT_MIN_LEN} символів)`,
      });
    }
    if (short.length > SHORT_MAX_LEN) {
      issues.push({
        type: 'too_long_short',
        severity: 'low',
        message: `Коротке пояснення занадто довге (${short.length} > ${SHORT_MAX_LEN})`,
      });
    }

    if (correct) {
      const simToAnswer = calculateTextSimilarity(short, correct);
      const simToQuestion = calculateTextSimilarity(short, questionText);
      if (simToAnswer > 0.85 && simToQuestion < 0.35) {
        issues.push({
          type: 'repeats_answer',
          severity: 'medium',
          message: 'Пояснення лише повторює правильну відповідь без контексту',
        });
      }
    }

    if (questionText && calculateTextSimilarity(short, questionText) > 0.7) {
      issues.push({
        type: 'duplicates_question',
        severity: 'medium',
        message: 'Пояснення дублює текст питання',
      });
    }
  }

  if (combined && correct) {
    const opts = (question.options ?? []).map((o) => String(o).trim()).filter(Boolean);
    const wrongMentioned = opts.filter((o, i) => {
      if (i === (question.correctIndex ?? 0)) return false;
      const norm = normalizeText(o);
      if (norm.length < 4) return false;
      return normalizeText(combined).includes(norm);
    });
    if (wrongMentioned.length > 0) {
      const hints = wrongMentioned.slice(0, 2).join('", "');
      issues.push({
        type: 'contradicts_answer',
        severity: 'high',
        message: `Пояснення акцентує неправильний варіант: "${hints}"`,
      });
    }
  }

  const refHint = referenceBookHint(question.reference);
  if (refHint && combined) {
    const bookInExpl = normalizeText(combined).includes(refHint);
    const hasContextWords = /поді|істор|контекст|писан|книг|розділ|глава|вірш/i.test(combined);
    if (!bookInExpl && !hasContextWords) {
      issues.push({
        type: 'no_scripture_context',
        severity: 'low',
        message: 'Є посилання, але пояснення не згадує Писання чи контекст',
      });
    }
  }

  for (const pattern of GENERIC_FILLER_PATTERNS) {
    if (pattern.test(combined)) {
      issues.push({
        type: 'generic_filler',
        severity: 'medium',
        message: 'Шаблонне пояснення без конкретного змісту',
      });
      break;
    }
  }

  for (const pattern of THEOLOGICAL_RED_FLAGS) {
    if (pattern.test(combined) || pattern.test(questionText)) {
      issues.push({
        type: 'theological_red_flag',
        severity: 'high',
        message: 'Можливе теологічне супереччя в поясненні',
      });
      break;
    }
  }

  let coverageScore = 0;
  switch (coverage) {
    case 'complete':
      coverageScore = 100;
      break;
    case 'short_only':
      coverageScore = 70;
      break;
    case 'orphan_deep':
      coverageScore = 40;
      break;
    default:
      coverageScore = 0;
  }

  let heuristicScore = coverageScore;
  for (const issue of issues) {
    if (issue.severity === 'high') heuristicScore -= 25;
    else if (issue.severity === 'medium') heuristicScore -= 12;
    else heuristicScore -= 5;
  }
  heuristicScore = Math.max(0, Math.min(100, heuristicScore));

  const preview = short || String(question.explanationDeep ?? '').trim();
  return {
    coverage,
    issues,
    heuristicScore,
    coverageScore,
    explanationShortPreview: preview.slice(0, 120),
  };
}

/**
 * @param {object} question
 * @param {object} [prev]
 */
export function buildExplanationReport(question, prev = {}) {
  const analysis = analyzeExplanation(question);
  return {
    questionId: question.id,
    themeId: question.themeId,
    text: String(question.text ?? '').slice(0, 200),
    source: question._source ?? question.source ?? 'unknown',
    coverage: analysis.coverage,
    heuristicScore: analysis.heuristicScore,
    coverageScore: analysis.coverageScore,
    aiScore: prev.aiScore ?? null,
    aiDetails: prev.aiDetails ?? null,
    issues: analysis.issues,
    explanationShortPreview: analysis.explanationShortPreview,
    reviewedAt: prev.reviewedAt ?? null,
  };
}

export function analyzeAllQuestions(questions, previousById = new Map()) {
  return questions.map((q) => buildExplanationReport(q, previousById.get(q.id) ?? {}));
}

export function summarizeReport(reports) {
  const summary = {
    total: reports.length,
    missing: 0,
    short_only: 0,
    complete: 0,
    orphan_deep: 0,
    avgHeuristicScore: 0,
    weak: 0,
    byTheme: {},
  };

  let scoreSum = 0;
  for (const r of reports) {
    if (summary[r.coverage] != null) summary[r.coverage] += 1;
    if (r.heuristicScore < 50) summary.weak += 1;
    scoreSum += r.heuristicScore;

    const tid = r.themeId || 'unknown';
    if (!summary.byTheme[tid]) {
      summary.byTheme[tid] = { total: 0, missing: 0, complete: 0, short_only: 0, orphan_deep: 0 };
    }
    summary.byTheme[tid].total += 1;
    summary.byTheme[tid][r.coverage] = (summary.byTheme[tid][r.coverage] ?? 0) + 1;
  }

  summary.avgHeuristicScore = reports.length
    ? Math.round(scoreSum / reports.length)
    : 0;

  return summary;
}
