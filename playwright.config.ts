import { defineConfig } from '@playwright/test';
const production = process.env.KINEO_TEST_PRODUCTION === '1';
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1,
  reporter: 'list', timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:5175', viewport: { width: 1440, height: 900 },
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH },
  },
  webServer: { command: `npm run ${production ? 'preview' : 'dev'} -- --host 127.0.0.1 --port 5175 --strictPort`, url: 'http://127.0.0.1:5175', reuseExistingServer: !process.env.CI },
});
