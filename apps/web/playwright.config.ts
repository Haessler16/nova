import { defineConfig, devices } from '@playwright/test';

/**
 * UI integration tests run against an already-running web/API pair.
 *
 * Required before running:
 * - API with the reservation-party migration applied
 * - synthetic seed data
 * - web at PLAYWRIGHT_BASE_URL (default http://localhost:3000)
 * - API at PLAYWRIGHT_API_URL (default http://localhost:3001)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
