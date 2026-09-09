import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify('0.0.0-test') },
  resolve: {
    alias: {
      '@contracts': path.resolve(__dirname, 'contracts/index.ts'),
      '@contracts/': `${path.resolve(__dirname, 'contracts')}/`,
    },
  },
  test: {
    environment: 'node',
    include: [
      'src/**/*.{test,spec}.ts',
      'server/**/*.{test,spec}.ts',
      'contracts/**/*.{test,spec}.ts',
    ],
    exclude: ['**/node_modules/**', 'dist/**'],
  },
});
