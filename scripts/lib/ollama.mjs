import http from 'http';

const DEFAULT_HOST = process.env.OLLAMA_HOST || 'localhost';
const DEFAULT_PORT = Number(process.env.OLLAMA_PORT || 11434);

function httpGetJson(path, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: DEFAULT_HOST,
        port: DEFAULT_PORT,
        path,
        method: 'GET',
        timeout: timeoutMs,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Помилка парсингу Ollama: ${e.message}`));
          }
        });
      },
    );
    req.on('error', (e) => reject(new Error(`Ollama недоступна (${DEFAULT_HOST}:${DEFAULT_PORT}): ${e.message}`)));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Таймаут Ollama (${timeoutMs / 1000}s)`));
    });
    req.end();
  });
}

export async function listOllamaModels() {
  const data = await httpGetJson('/api/tags');
  return (data?.models ?? []).map((m) => m.name).filter(Boolean);
}

export function modelMatches(requested, available) {
  const wanted = String(requested || '').trim().toLowerCase();
  if (!wanted) return false;
  return available.some((name) => {
    const n = String(name).toLowerCase();
    return n === wanted || n.startsWith(`${wanted}:`) || wanted.startsWith(`${n.split(':')[0]}:`);
  });
}

/** Текст відповіді з /api/generate (Qwen3 інколи кладе JSON у thinking, а response лишає порожнім). */
export function coalesceOllamaText(parsed) {
  const response = String(parsed?.response ?? '').trim();
  if (response) return response;
  return String(parsed?.thinking ?? '').trim();
}

/** Швидка перевірка: Ollama online + модель у списку (без пробного generate). */
export async function checkOllama(model, options = {}) {
  const { quick = false, timeoutMs = 120000 } = options;
  const models = await listOllamaModels();
  if (!modelMatches(model, models)) {
    const preview = models.slice(0, 5).join(', ') || 'немає';
    throw new Error(`Модель "${model}" не знайдена. Доступні: ${preview}`);
  }
  if (quick) return true;
  const response = await queryOllama('Відповідай одним словом: OK', model, { temperature: 0, timeoutMs });
  return Boolean(response?.trim());
}

export function queryOllama(prompt, model = 'mistral', options = {}) {
  const {
    temperature = 0.7,
    timeoutMs = 180000,
    format,
    numCtx,
    numPredict,
    seed,
  } = options;

  return new Promise((resolve, reject) => {
    // Ollama /api/generate expects model-tuning params under `options`, not top-level.
    const ollamaOptions = { temperature };
    if (typeof numCtx === 'number') ollamaOptions.num_ctx = numCtx;
    if (typeof numPredict === 'number') ollamaOptions.num_predict = numPredict;
    if (typeof seed === 'number') ollamaOptions.seed = seed;

    const payload = {
      model,
      prompt,
      stream: false,
      options: ollamaOptions,
    };
    if (format) payload.format = format;

    const body = JSON.stringify(payload);

    const req = http.request(
      {
        hostname: DEFAULT_HOST,
        port: DEFAULT_PORT,
        path: '/api/generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed?.error) {
              reject(new Error(`Ollama API error: ${parsed.error}`));
              return;
            }
            resolve(coalesceOllamaText(parsed));
          } catch (e) {
            reject(new Error(`Помилка парсингу Ollama: ${e.message}`));
          }
        });
      },
    );

    req.on('error', (e) => reject(new Error(`Ollama недоступна (${DEFAULT_HOST}:${DEFAULT_PORT}): ${e.message}`)));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Таймаут Ollama (${timeoutMs / 1000}s)`));
    });

    req.write(body);
    req.end();
  });
}

/** Витягує перший JSON-масив з відповіді AI (між балансованими [ ]). */
export function extractJsonArray(text) {
  if (typeof text !== 'string') {
    throw new Error('Очікувано рядок з JSON-масивом');
  }
  const start = text.indexOf('[');
  if (start === -1) throw new Error('JSON-масив не знайдено у відповіді AI');

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        return JSON.parse(candidate);
      }
    }
  }
  throw new Error('JSON-масив не закрито у відповіді AI');
}

/** Витягує перший JSON-обʼєкт з відповіді AI (між балансованими { }). */
export function extractJsonObject(text) {
  if (typeof text !== 'string') {
    throw new Error('Очікувано рядок з JSON-обʼєктом');
  }
  const start = text.indexOf('{');
  if (start === -1) throw new Error('JSON-обʼєкт не знайдено у відповіді AI');

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        return JSON.parse(candidate);
      }
    }
  }
  throw new Error('JSON-обʼєкт не закрито у відповіді AI');
}

/**
 * Намагається витягти JSON (масив або обʼєкт) з відповіді AI.
 * Кидає помилку, якщо нічого знайти не вдалося.
 */
export function extractJson(text) {
  const arrayIdx = text.indexOf('[');
  const objectIdx = text.indexOf('{');
  const hasArray = arrayIdx !== -1;
  const hasObject = objectIdx !== -1;
  if (!hasArray && !hasObject) {
    throw new Error('JSON не знайдено у відповіді AI');
  }
  const arrayFirst = hasArray && (!hasObject || arrayIdx < objectIdx);
  try {
    return arrayFirst ? extractJsonArray(text) : extractJsonObject(text);
  } catch {
    return arrayFirst ? extractJsonObject(text) : extractJsonArray(text);
  }
}
