import { defineConfig, devices } from '@playwright/test'

// Override for CI against a deployed preview, e.g. PLAYWRIGHT_BASE_URL=https://example.com
// Use localhost (not 127.0.0.1): on some hosts Vite binds only to ::1 / "localhost".
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'

const hasE2ECreds =
  Boolean(process.env.E2E_TEST_EMAIL?.trim()) &&
  Boolean(process.env.E2E_TEST_PASSWORD)

const hasE2ECredsB =
  Boolean(process.env.E2E_TEST_EMAIL_B?.trim()) &&
  Boolean(process.env.E2E_TEST_PASSWORD_B)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  // Install browsers once: npx playwright install chromium
  webServer: {
    command: 'npm run dev:e2e',
    url: baseURL,
    cwd: import.meta.dirname,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'unauthenticated',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /\/(smoke|guards|auth-page|home-flows)\.spec\.ts$/,
    },
    ...(hasE2ECreds
      ? [
          {
            name: 'setup',
            testMatch: /\/auth\.setup\.ts$/,
            use: { ...devices['Desktop Chrome'] },
          },
          ...(hasE2ECredsB
            ? [
                {
                  name: 'setup-b',
                  testMatch: /\/auth-b\.setup\.ts$/,
                  use: { ...devices['Desktop Chrome'] },
                },
                {
                  name: 'multiplayer',
                  testMatch: /\/realtime-session\.spec\.ts$/,
                  dependencies: ['setup' as const, 'setup-b' as const],
                  timeout: 240_000,
                  use: { ...devices['Desktop Chrome'] },
                },
              ]
            : []),
          {
            name: 'authenticated',
            testMatch: /\/app-authenticated\.spec\.ts$/,
            dependencies: ['setup' as const],
            use: {
              ...devices['Desktop Chrome'],
              storageState: 'playwright/.auth/user.json',
            },
          },
        ]
      : []),
  ],
})
