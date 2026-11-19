import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/{u1,u2}/**/*.test.{ts,tsx}'],
    hookTimeout: 90_000,
    testTimeout: 60_000,
    coverage: {
      include: ['src/server/**/*.ts', 'src/web/**/*.ts', 'src/web/**/*.tsx'],
      exclude: ['src/server/generated/**'],
      reportOnFailure: true,
      thresholds: { lines: 80 },
    },
  },
});
