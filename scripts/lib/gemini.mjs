const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_RATE_LIMIT_RETRIES = 100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 429 / quota / rate limit — тимчасове обмеження free tier. */
export function isGeminiRateLimitError(status, message) {
  if (status === 429) return true;
  const text = String(message || '').toLowerCase();
  return (
    text.includes('(429)')
    || text.includes('quota')
    || text.includes('rate limit')
    || text.includes('rate-limit')
    || text.includes('resource exhausted')
    || text.includes('too many requests')
  );
}

/** Парсить "Please retry in 2.295570785s" з повідомлення Gemini. */
export function parseGeminiRetryDelayMs(message, fallbackMs = 5000) {
  const text = String(message || '');
  const secMatch = text.match(/retry(?: in| after)?\s+(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?/i);
  if (secMatch) return Math.ceil(parseFloat(secMatch[1]) * 1000) + 500;
  const msMatch = text.match(/retry(?: in| after)?\s+(\d+(?:\.\d+)?)\s*ms/i);
  if (msMatch) return Math.ceil(parseFloat(msMatch[1])) + 500;
  return fallbackMs;
}

export const GEMINI_MODEL_PRESETS = [
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
];

function getApiKey() {
  const key = String(process.env.GEMINI_API_KEY || '').trim();
  if (!key) {
    throw new Error('GEMINI_API_KEY не задано. Додай ключ у .env (Google AI Studio).');
  }
  return key;
}

function defaultModel() {
  return process.env.GEMINI_MODEL || process.env.AI_MODEL || 'gemini-3.1-flash-lite';
}

async function fetchJson(url, options = {}, timeoutMs = 60000, retryState = {}) {
  const maxRateLimitRetries = retryState.maxRateLimitRetries ?? DEFAULT_RATE_LIMIT_RETRIES;
  let rateLimitAttempts = retryState.rateLimitAttempts ?? 0;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Gemini: не вдалось розпарсити відповідь (${res.status})`);
    }
    if (!res.ok) {
      const msg = data?.error?.message || data?.message || text.slice(0, 200) || res.statusText;
      if (isGeminiRateLimitError(res.status, msg) && rateLimitAttempts < maxRateLimitRetries) {
        const delayMs = parseGeminiRetryDelayMs(msg);
        console.warn(
          `  ⏳ Gemini rate limit — очікування ${(delayMs / 1000).toFixed(1)}s`
          + ` (спроба ${rateLimitAttempts + 1}/${maxRateLimitRetries})…`,
        );
        await sleep(delayMs);
        retryState.rateLimitAttempts = rateLimitAttempts + 1;
        return fetchJson(url, options, timeoutMs, retryState);
      }
      throw new Error(`Gemini API (${res.status}): ${msg}`);
    }
    return data;
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error(`Таймаут Gemini (${timeoutMs / 1000}s)`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => String(p?.text ?? '')).join('').trim();
  if (text) return text;
  const reason = data?.candidates?.[0]?.finishReason;
  if (reason && reason !== 'STOP') {
    throw new Error(`Gemini: відповідь обрізана (${reason})`);
  }
  throw new Error('Gemini: порожня відповідь');
}

export async function listGeminiModels() {
  const key = getApiKey();
  const url = `${GEMINI_API_BASE}/models?key=${encodeURIComponent(key)}`;
  const data = await fetchJson(url, { method: 'GET' }, 15000);
  return (data?.models ?? [])
    .map((m) => String(m?.name || '').replace(/^models\//, ''))
    .filter((id) => id && id.includes('gemini'));
}

export async function checkGemini(model, options = {}) {
  const { quick = false, timeoutMs = 120000 } = options;
  const name = (model || defaultModel()).trim();
  getApiKey();
  if (quick) {
    await listGeminiModels();
    return true;
  }
  const response = await queryGemini('Відповідай одним словом: OK', name, { temperature: 0, timeoutMs });
  return Boolean(response?.trim());
}

export async function queryGemini(prompt, model, options = {}) {
  const {
    temperature = 0.7,
    timeoutMs = 180000,
    format,
  } = options;

  const key = getApiKey();
  const modelId = (model || defaultModel()).trim();
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(key)}`;

  const generationConfig = { temperature };
  if (format === 'json') {
    generationConfig.responseMimeType = 'application/json';
  }

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig,
  };

  const data = await fetchJson(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
  return extractGeminiText(data);
}
