import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  checkOllama,
  queryOllama,
  extractJson,
  extractJsonArray,
  extractJsonObject,
} from './ollama.mjs';
import {
  checkGemini,
  isGeminiRateLimitError,
  parseGeminiRetryDelayMs,
  queryGemini,
} from './gemini.mjs';
import { checkOmniRoute, queryOmniRoute } from './omniroute.mjs';

export { extractJson, extractJsonArray, extractJsonObject };
export { isGeminiRateLimitError as isRateLimitError, parseGeminiRetryDelayMs as parseRateLimitRetryDelayMs };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');

let envLoaded = false;

/** Простий парсер .env (як у ai_launcher.py). */
export function loadProjectEnv() {
  if (envLoaded) return;
  if (!fs.existsSync(ENV_PATH)) {
    envLoaded = true;
    return;
  }
  try {
    const text = fs.readFileSync(ENV_PATH, 'utf-8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key && process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  } catch {
    /* ignore */
  }
  envLoaded = true;
}

export const AI_PROVIDERS = ['ollama', 'gemini', 'omniroute'];

export function normalizeProvider(raw) {
  const p = String(raw || 'ollama').trim().toLowerCase();
  if (!AI_PROVIDERS.includes(p)) {
    throw new Error(`Невідомий провайдер "${raw}". Допустимо: ${AI_PROVIDERS.join(', ')}`);
  }
  return p;
}

export function resolveProvider(opts = {}) {
  loadProjectEnv();
  const fromOpts = opts.provider ?? opts.aiProvider;
  if (fromOpts) return normalizeProvider(fromOpts);
  return normalizeProvider(process.env.AI_PROVIDER || 'ollama');
}

export function resolveModel(provider, opts = {}) {
  loadProjectEnv();
  if (opts.model) return String(opts.model).trim();

  const unified = process.env.AI_MODEL?.trim();
  if (unified) return unified;

  switch (provider) {
    case 'gemini':
      return process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
    case 'omniroute':
      return process.env.OMNIROUTE_MODEL || 'google/gemini-2.0-flash';
    default:
      return process.env.OLLAMA_MODEL || 'mistral';
  }
}

/** Парсить --provider та --model з argv; повертає { provider, model, rest }. */
export function parseAiArgs(argv, defaults = {}) {
  loadProjectEnv();
  let provider = defaults.provider ? normalizeProvider(defaults.provider) : resolveProvider({});
  let model = defaults.model ? String(defaults.model).trim() : resolveModel(provider, {});
  const rest = [];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--provider' && argv[i + 1]) {
      provider = normalizeProvider(argv[++i]);
      if (!defaults.model && !argv.includes('--model')) {
        model = resolveModel(provider, {});
      }
      continue;
    }
    if (argv[i] === '--model' && argv[i + 1]) {
      model = argv[++i];
      continue;
    }
    rest.push(argv[i]);
  }

  return { provider, model, rest };
}

/** Спрощений парсер для вбудовування в існуючі parseArgs. */
export function applyAiCliFlags(opts, args) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--provider' && args[i + 1]) {
      opts.provider = normalizeProvider(args[++i]);
    } else if (args[i] === '--model' && args[i + 1]) {
      opts.model = args[++i];
    }
  }
  if (!opts.provider) opts.provider = resolveProvider({});
  if (!opts.model) opts.model = resolveModel(opts.provider, {});
  return opts;
}

export function defaultAiOpts() {
  loadProjectEnv();
  const provider = resolveProvider({});
  const model = resolveModel(provider, {});
  return { provider, model };
}

export async function queryLLM(prompt, options = {}) {
  loadProjectEnv();
  const provider = normalizeProvider(options.provider ?? resolveProvider({}));
  const model = options.model ?? resolveModel(provider, {});

  switch (provider) {
    case 'gemini':
      return queryGemini(prompt, model, options);
    case 'omniroute':
      return queryOmniRoute(prompt, model, options);
    default:
      return queryOllama(prompt, model, options);
  }
}

export async function checkLLM(model, options = {}) {
  loadProjectEnv();
  const provider = normalizeProvider(options.provider ?? resolveProvider({}));
  const resolvedModel = model ?? resolveModel(provider, options);

  switch (provider) {
    case 'gemini':
      return checkGemini(resolvedModel, options);
    case 'omniroute':
      return checkOmniRoute(resolvedModel, options);
    default:
      return checkOllama(resolvedModel, options);
  }
}

export function providerLabel(provider) {
  switch (normalizeProvider(provider)) {
    case 'gemini':
      return 'Gemini';
    case 'omniroute':
      return 'OmniRoute';
    default:
      return 'Ollama';
  }
}

export function unavailableHint(provider) {
  switch (normalizeProvider(provider)) {
    case 'gemini':
      return 'Перевір GEMINI_API_KEY у .env (Google AI Studio).';
    case 'omniroute':
      return 'Запусти OmniRoute і вкажи OMNIROUTE_API_KEY у .env.';
    default:
      return 'Запусти: ollama serve';
  }
}
