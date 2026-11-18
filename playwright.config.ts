import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e/u1',
  workers: 1,
  use: { browserName: 'chromium', ignoreHTTPSErrors: true, locale: 'ko-KR' },
});
