import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Runtime uses vite.config.mjs (see scripts/run-vite.mjs).
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(process.env.VITE_BUILD_ID || '0.0.0-dev') },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@core': path.resolve(__dirname, 'src/core'),
      '@contracts': path.resolve(__dirname, 'contracts/index.ts'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
