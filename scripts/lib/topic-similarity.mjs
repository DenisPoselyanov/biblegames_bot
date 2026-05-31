/**
 * Heuristic similarity for topic titles/descriptions (conveyor dedup, analyze-topics).
 */

export const DEFAULT_THRESHOLD_TITLE = 0.55;
export const DEFAULT_THRESHOLD_FULL = 0.4;
export const BORDERLINE_LOW = 0.35;

export function normalizeTopicWords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\sа-яґєії]/gi, '')
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

export function jaccardSimilarity(words1, words2) {
  if (!words1?.length || !words2?.length) return 0;
  const intersection = words1.filter((w) => words2.includes(w));
  const union = [...new Set([...words1, ...words2])];
  return intersection.length / union.length;
}

export function topicSimilarity(a, b) {
  const titleA = normalizeTopicWords(a?.title || a);
  const titleB = normalizeTopicWords(b?.title || b);
  const titleScore = jaccardSimilarity(titleA, titleB);
  const fullA = normalizeTopicWords(`${a?.title || a} ${a?.description || ''}`);
  const fullB = normalizeTopicWords(`${b?.title || b} ${b?.description || ''}`);
  const fullScore = jaccardSimilarity(fullA, fullB);
  return Math.max(titleScore, fullScore);
}

export function findSimilarEntries(candidate, catalog, opts = {}) {
  const thresholdTitle = opts.thresholdTitle ?? DEFAULT_THRESHOLD_TITLE;
  const thresholdFull = opts.thresholdFull ?? DEFAULT_THRESHOLD_FULL;
  const similarTo = [];

  for (const entry of catalog || []) {
    if (!entry?.title) continue;
    if (candidate?.id && entry.id === candidate.id) continue;

    const titleA = normalizeTopicWords(candidate?.title);
    const titleB = normalizeTopicWords(entry.title);
    const titleScore = jaccardSimilarity(titleA, titleB);
    const fullScore = topicSimilarity(candidate, entry);
    const score = Math.max(titleScore, fullScore);

    if (titleScore >= thresholdTitle || fullScore >= thresholdFull) {
      similarTo.push({
        id: entry.id,
        title: entry.title,
        score: Math.round(score * 100),
        path: entry.path || entry.title,
      });
    }
  }

  similarTo.sort((a, b) => b.score - a.score);
  return { similarTo: similarTo.slice(0, 8) };
}

export function filterUniqueCandidates(nodes, catalog, opts = {}) {
  const thresholdTitle = opts.thresholdTitle ?? DEFAULT_THRESHOLD_TITLE;
  const thresholdFull = opts.thresholdFull ?? DEFAULT_THRESHOLD_FULL;
  const unique = [];
  const warnings = [];
  let filteredCount = 0;

  for (const node of nodes || []) {
    const { similarTo } = findSimilarEntries(node, catalog, { thresholdTitle, thresholdFull });
    if (similarTo.length) {
      filteredCount++;
      warnings.push({
        title: node.title,
        similarTo: similarTo[0],
        allSimilar: similarTo,
      });
    } else {
      unique.push(node);
    }
  }

  return { unique, warnings, filteredCount };
}

export function formatAvoidList(entries, max = 25) {
  const lines = [];
  for (const e of (entries || []).slice(0, max)) {
    const label = e.path ? `${e.title} (${e.path})` : e.title;
    lines.push(`- ${label}`);
  }
  return lines.join('\n');
}

export function buildUniquenessResult({ warnings = [], filteredCount = 0, retries = 0 } = {}) {
  return {
    warnings,
    filteredCount,
    retries,
  };
}
