import http from 'http';

const DEFAULT_HOST = process.env.OLLAMA_HOST || 'localhost';
const DEFAULT_PORT = Number(process.env.OLLAMA_PORT || 11434);

export async function checkOllama(model) {
  const response = await queryOllama('Відповідай одним словом: OK', model, { temperature: 0 });
  return Boolean(response?.trim());
}

export function queryOllama(prompt, model = 'mistral', options = {}) {
  const {
    temperature = 0.7,
    timeoutMs = 180000,
    format,
    numCtx,
    seed,
  } = options;

  return new Promise((resolve, reject) => {
    // Ollama /api/generate expects model-tuning params under `options`, not top-level.
    const ollamaOptions = { temperature };
    if (typeof numCtx === 'number') ollamaOptions.num_ctx = numCtx;
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
            resolve(parsed.response || '');
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
