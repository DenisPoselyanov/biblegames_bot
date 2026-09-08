import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `spike/` holds throwaway exploration (Phase 2 WS2 Drizzle spike) — it
  // deliberately imports deps not yet in package.json and is not a build input.
  globalIgnores(['dist', 'spike']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Isomorphic runtime contracts (Phase 2 §7) — no React, no Node, no DOM assumptions.
    files: ['contracts/**/*.ts'],
    languageOptions: {
      globals: {},
    },
    rules: {
      'react-refresh/only-export-components': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
      // ADR-012: `@contracts` is Zod-only. Drizzle (and `drizzle-zod`) are
      // storage-layer concerns — a `drizzle-zod` schema must never be
      // re-exported from a contract module.
      'no-restricted-imports': [
        'error',
        { paths: ['drizzle-zod', 'drizzle-orm', 'drizzle-orm/pg-core'] },
      ],
    },
  },
  {
    // Node runtimes: Express server, CLI scripts, admin bot, config files.
    files: [
      'server/**/*.{ts,tsx}',
      'scripts/**/*.{ts,tsx}',
      'bot/**/*.{ts,tsx}',
      '*.config.{ts,mts}',
      'vitest.config.ts',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // These runtimes are not React — the react-* rule sets don't apply.
      // (e.g. server/services/questionService.ts has a plain `useQuestionsSql()`
      // predicate that rules-of-hooks would otherwise flag.)
      'react-refresh/only-export-components': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
])
