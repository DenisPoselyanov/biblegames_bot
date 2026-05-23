import http from 'http';

const DEFAULT_HOST = process.env.OLLAMA_HOST || 'localhost';
const DEFAULT_PORT = Number(process.env.OLLAMA_PORT || 11434);

export async function checkOllama(model) {
  const response = await queryOllama('Відповідай одним словом: OK', model, { temperature: 0 });
  return Boolean(response?.trim());
}

export function queryOllama(prompt, model = 'mistral', options = {}) {
  const { temperature = 0.7, timeoutMs = 180000 } = options;

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      prompt,
      stream: false,
      temperature,
    });

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

export function extractJsonArray(text) {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('JSON-масив не знайдено у відповіді AI');
  return JSON.parse(match[0]);
}

export function extractJsonObject(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('JSON-об\'єкт не знайдено у відповіді AI');
  return JSON.parse(match[0]);
}
