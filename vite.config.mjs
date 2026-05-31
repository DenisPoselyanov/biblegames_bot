import path from 'node:path'
import os from 'node:os'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  cacheDir: path.join(os.tmpdir(), 'biblegames-bot-vite'),
})
