function baseUrl() {
  const raw = String(process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128/v1').trim();
  return raw.replace(/\/+$/, '');
}

function getApiKey() {
  const key = String(process.env.OMNIROUTE_API_KEY || '').trim();
  if (!key) {
    throw new Error('OMNIROUTE_API_KEY не задано. Створи ключ у дашборді OmniRoute (Endpoints).');
  }
  return key;
}

function defaultModel() {
  return process.env.OMNIROUTE_MODEL || process.env.AI_MODEL || 'google/gemini-2.0-flash';
}

async function fetchJson(path, options = {}, timeoutMs = 60000) {
  const url = path.startsWith('http') ? path : `${baseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`OmniRoute: не вдалось розпарсити відповідь (${res.status})`);
    }
    if (!res.ok) {
      const msg = data?.error?.message || data?.message || text.slice(0, 200) || res.statusText;
      throw new Error(`OmniRoute (${res.status}): ${msg}`);
    }
    return data;
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error(`Таймаут OmniRoute (${timeoutMs / 1000}s)`);
    }
    if (e.cause?.code === 'ECONNREFUSED' || /fetch failed/i.test(e.message)) {
      throw new Error(`OmniRoute недоступний (${baseUrl()}). Запусти omniroute локально.`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders() {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
  };
}

function extractChatText(data) {
  const text = String(data?.choices?.[0]?.message?.content ?? '').trim();
  if (text) return text;
  throw new Error('OmniRoute: порожня відповідь chat/completions');
}

export async function listOmniRouteModels() {
  getApiKey();
  const data = await fetchJson('/models', { method: 'GET', headers: authHeaders() }, 15000);
  return (data?.data ?? []).map((m) => m.id).filter(Boolean);
}

export async function checkOmniRoute(model, options = {}) {
  const { quick = false, timeoutMs = 120000 } = options;
  const name = (model || defaultModel()).trim();
  getApiKey();
  if (quick) {
    await listOmniRouteModels();
    return true;
  }
  const response = await queryOmniRoute('Відповідай одним словом: OK', name, { temperature: 0, timeoutMs });
  return Boolean(response?.trim());
}

export async function queryOmniRoute(prompt, model, options = {}) {
  const {
    temperature = 0.7,
    timeoutMs = 180000,
    format,
  } = options;

  const body = {
    model: (model || defaultModel()).trim(),
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    temperature,
  };
  if (format === 'json') {
    body.response_format = { type: 'json_object' };
  }

  const data = await fetchJson(
    '/chat/completions',
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
  return extractChatText(data);
}
