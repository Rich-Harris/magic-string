import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    isolate: false,
    coverage: {
      exclude: [
        'src/**/*.test.ts',
        'tests/**',
        'dist/**',
        'benchmark/**',
      ],
    },
    benchmark: {
      include: ['benchmark/**/*.bench.ts'],
    },
  },
})
