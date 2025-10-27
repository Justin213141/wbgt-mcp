import { defineConfig } from 'vitest/config'
import { VitestReporter } from 'tdd-guard-vitest'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    reporters: [
      'default',
      new VitestReporter('/home/justin/wbgt-mcp-server'),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 40,
        statements: 75,
      },
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        'src/index.ts', // Entry point with minimal logic
      ],
    },
  },
})
