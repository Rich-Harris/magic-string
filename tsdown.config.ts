import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  sourcemap: true,
  define: {
    DEBUG: 'false',
  },
  exports: true,
  publint: true,
})
