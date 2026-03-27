import { test, expect } from '@playwright/test'

test.describe('marketing home CTAs (logged out)', () => {
  test('Get Started navigates to auth', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Get Started' }).click()
    await expect(page).toHaveURL(/\/auth$/)
    await expect(page.getByText('Welcome back')).toBeVisible()
  })

  test('Sign in navigates to auth', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/auth$/)
  })
})
