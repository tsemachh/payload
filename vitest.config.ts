import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['node_modules', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules', 'tests/**'],
    },
  },
  resolve: {
    alias: [
      {
        find: '@/components',
        replacement: path.resolve(__dirname, './src/app/(frontend)/components'),
      },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
})
