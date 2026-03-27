import { test, expect } from '@playwright/test'

const protectedPaths = [
  '/app',
  '/create',
  '/join',
  '/join/INVITE1',
  '/session/e2e-test-session',
] as const

test.describe('protected routes redirect to auth when logged out', () => {
  for (const path of protectedPaths) {
    test(`${path} → /auth`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/auth/, { timeout: 15_000 })
    })
  }
})
