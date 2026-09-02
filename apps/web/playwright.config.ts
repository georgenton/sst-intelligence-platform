import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --dir ../api dev',
      url: 'http://127.0.0.1:3101/api/v1/health',
      env: { ...process.env, PORT: '3101' },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    ...[3102, 3103, 3104].map((port) => ({
      command: 'pnpm --dir ../api dev',
      url: `http://127.0.0.1:${port}/api/v1/health`,
      env: { ...process.env, PORT: String(port) },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    })),
    {
      command: 'pnpm exec next dev --webpack --port 3100',
      url: 'http://127.0.0.1:3100/app/inspections',
      env: { ...process.env, API_ORIGIN: 'http://127.0.0.1:3101' },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
