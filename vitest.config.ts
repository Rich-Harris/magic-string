import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    DEBUG: 'true',
  },
  test: {
    environment: 'node',
    isolate: false,
    coverage: {
      exclude: [
        'src/**/*.test.ts',
        'tests/**',
        'dist/**',
      ],
    },
  },
})
