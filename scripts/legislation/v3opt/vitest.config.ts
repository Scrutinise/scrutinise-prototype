import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    include: ['__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      'adm-zip': path.resolve(process.cwd(), 'node_modules/adm-zip'),
      'fast-xml-parser': path.resolve(process.cwd(), 'node_modules/fast-xml-parser'),
    },
  },
})
