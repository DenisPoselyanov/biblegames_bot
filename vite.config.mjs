import path from 'node:path'
import os from 'node:os'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** GitHub Pages: https://denisposelyanov.github.io/biblegames_bot/ */
const pagesBase = process.env.VITE_BASE_PATH?.replace(/\/?$/, '/') || '/'

export default defineConfig({
  base: pagesBase,
  plugins: [react()],
  cacheDir: path.join(os.tmpdir(), 'biblegames-bot-vite'),
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
