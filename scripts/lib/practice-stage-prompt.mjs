/**
 * AI prompt + validation for per-subtopic practice stage counts (biblical richness).
 */

import { DIFFICULTIES } from './themes-config.mjs';
import { STAGE_COUNT_BY_DIFFICULTY } from './practice-config.mjs';
import { extractJsonObject } from './llm.mjs';

export const DEFAULT_FALLBACK_BASE_STAGES = 2;

export function buildPracticeStagePrompt(context) {
  const caps = DIFFICULTIES.map(
    (d) => `${d}: макс. ${STAGE_COUNT_BY_DIFFICULTY[d]} етапів`,
  ).join(', ');

  return `Ти експерт з біблійних текстів (Протестантський канон, українська мова).

Оціни підтему для режиму практики (блоки по ~10 вікторинних питань). НЕ враховуй жодної бази питань, додатків чи ігор — лише канонічний біблійний матеріал.

Підтема: ${context.title}
Шлях в ієрархії: ${context.pathStr}
Опис у додатку: ${context.description || '(немає)'}

Критерії:
1. Скільки змістовного біблійного матеріалу (події, персонажі, місця, хронологія, закон, богослов'я)?
2. Чи тема згадується стисло (1–2 уривки) чи розгорнуто (ціла книга / довга дуга)?
3. Тип: географія / постать з одним епізодом / подія / книга / законодавство тощо.

Шкала biblicalRichness (1–5):
- 1: мінімум тексту (одна згадка, короткий епізод)
- 2: вузько (2–4 ключові факти)
- 3: помірно (кілька сюжетів або розділ)
- 4: багато (більша частина книги або багато персонажів)
- 5: дуже багато (ціла книга або широка дуга)

recommendedBaseStages (1–5): скільки етапів практики доречно за змістом (не більше biblicalRichness).

stagesByDifficulty — для кожного рангу складності окремо (менші ранги можуть мати більше етапів):
${caps}

Правила stagesByDifficulty:
- Не перевищуй максимум для рангу.
- theologian ≤ teacher ≤ preacher ≤ student ≤ youth ≤ child ≤ baby (вищий ранг — не більше етапів, ніж нижчий).
- Вузькі теми (Тимофій, Голгофа, одна згадка) — зазвичай 1–2 етапи на всіх рангах.
- Великі книги — більше на baby/youth, менше на theologian.

Відповідай ТІЛЬКИ JSON-об'єктом:
{
  "biblicalRichness": 2,
  "recommendedBaseStages": 2,
  "stagesByDifficulty": {
    "baby": 2,
    "child": 2,
    "youth": 2,
    "student": 2,
    "preacher": 2,
    "teacher": 2,
    "theologian": 2
  },
  "reasoning": "1–3 речення українською"
}`;
}

function clampInt(n, min, max) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

/** Enforce non-increasing stages from baby → theologian. */
export function normalizeStagesByDifficulty(rawStages, recommendedBase) {
  const base = clampInt(recommendedBase, 1, 5);
  const order = [...DIFFICULTIES];
  const out = {};
  let prev = base;

  for (const d of order) {
    const cap = STAGE_COUNT_BY_DIFFICULTY[d] ?? 5;
    let v = rawStages?.[d];
    if (v == null) v = Math.min(cap, prev);
    v = clampInt(v, 1, cap);
    v = Math.min(v, prev, base);
    out[d] = v;
    prev = v;
  }

  return out;
}

export function buildFallbackStages(baseStages = DEFAULT_FALLBACK_BASE_STAGES) {
  return normalizeStagesByDifficulty(
    Object.fromEntries(DIFFICULTIES.map((d) => [d, baseStages])),
    baseStages,
  );
}

export function parsePracticeStageResponse(raw) {
  const obj = extractJsonObject(raw);
  if (!obj || typeof obj !== 'object') {
    throw new Error('Не вдалося розпарсити JSON від моделі');
  }

  const richness = clampInt(obj.biblicalRichness, 1, 5);
  const base = clampInt(obj.recommendedBaseStages ?? richness, 1, 5);
  const stages = normalizeStagesByDifficulty(obj.stagesByDifficulty, Math.min(base, richness));
  const reasoning = String(obj.reasoning ?? '').trim().slice(0, 500);

  return {
    biblicalRichness: richness,
    recommendedBaseStages: Math.min(base, richness),
    stages,
    reasoning: reasoning || 'Без пояснення',
  };
}
