import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['lib/__tests__/**/*.test.ts', 'lib/v3/__tests__/**/*.test.ts', 'components/__tests__/**/*.test.tsx'],
    css: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
});
