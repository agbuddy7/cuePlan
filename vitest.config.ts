import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/domain/**/*.ts',
        'src/state/workspace.ts',
        'src/application/**/*.ts',
        'src/server/**/*.ts',
      ],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: { lines: 95, functions: 95, branches: 85, statements: 95 },
    },
  },
});
