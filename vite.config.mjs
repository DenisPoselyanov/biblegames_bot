import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** GitHub Pages: https://denisposelyanov.github.io/biblegames_bot/ */
const pagesBase = process.env.VITE_BASE_PATH?.replace(/\/?$/, '/') || '/'

const pkgVersion = createRequire(import.meta.url)('./package.json').version
/** Build version baked into the bundle for frontend error reports (Phase 2 §20). */
const appVersion = process.env.VITE_BUILD_ID || `${pkgVersion}-dev`

export default defineConfig({
  base: pagesBase,
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  plugins: [react()],
  cacheDir: path.join(os.tmpdir(), 'biblegames-bot-vite'),
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@core': path.resolve(import.meta.dirname, 'src/core'),
      '@contracts': path.resolve(import.meta.dirname, 'contracts/index.ts'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
