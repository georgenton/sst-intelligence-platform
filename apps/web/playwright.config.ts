import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --dir ../api dev',
      url: 'http://127.0.0.1:3101/api/v1/health',
      env: { ...process.env, PORT: '3101' },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm exec next dev --webpack --port 3100',
      url: 'http://127.0.0.1:3100',
      env: { ...process.env, API_ORIGIN: 'http://127.0.0.1:3101' },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
