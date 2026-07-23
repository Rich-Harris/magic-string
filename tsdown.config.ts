import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  define: {
    DEBUG: 'false',
  },
  exports: true,
  publint: true,
})
