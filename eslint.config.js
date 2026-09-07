import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
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
