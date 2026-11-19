import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: ['**/u1/**/*.spec.ts', '**/u2/**/*.spec.ts', '**/u3/**/*.spec.ts'],
  workers: 1,
  use: { browserName: 'chromium', ignoreHTTPSErrors: true, locale: 'ko-KR' },
});
