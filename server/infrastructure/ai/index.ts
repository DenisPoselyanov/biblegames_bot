/**
 * AI provider composition (Phase 4 §7). `createAiProvider` picks the adapter
 * from config the same way `server/infrastructure/storage/index.ts` picks an
 * object store — one place reads `ServerConfig`, domain/job code takes the
 * resulting `AiProvider` as a dependency.
 */
import type { ServerConfig } from '../../config/env';
import type { AiProvider } from '../../domains/ai/types';
import { createGeminiProvider } from './geminiProvider';
import { createMockAiProvider } from './mockProvider';
import { createOpenAiCompatibleProvider } from './openAiCompatibleProvider';

export type { AiProvider } from '../../domains/ai/types';
export { AiProviderError } from '../../domains/ai/types';
export { createGeminiProvider, GeminiProvider } from './geminiProvider';
export { createOpenAiCompatibleProvider, OpenAiCompatibleProvider } from './openAiCompatibleProvider';
export { createMockAiProvider, MockAiProvider } from './mockProvider';

/**
 * `null` when no provider is configured (no API key) — callers must treat a
 * missing provider as "AI generation unavailable" rather than crash the
 * process, since content-ai job types are opt-in (`server/jobs/index.ts`).
 */
export function createAiProvider(config: ServerConfig): AiProvider | null {
  switch (config.aiProvider) {
    case 'gemini':
      if (!config.geminiApiKey) return null;
      return createGeminiProvider({ apiKey: config.geminiApiKey, model: config.geminiModel });
    case 'groq':
      if (!config.groqApiKey) return null;
      return createOpenAiCompatibleProvider({
        name: 'groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: config.groqApiKey,
        model: config.groqModel,
      });
    case 'openrouter':
      if (!config.openRouterApiKey) return null;
      return createOpenAiCompatibleProvider({
        name: 'openrouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: config.openRouterApiKey,
        model: config.openRouterModel,
      });
    case 'mock':
      return createMockAiProvider();
    default:
      return null;
  }
}
