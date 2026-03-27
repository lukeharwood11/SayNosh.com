import { test, expect } from '@playwright/test'

test.describe('auth page UI', () => {
  test('login mode shows email, password, Google, and sign-in submit', async ({ page }) => {
    await page.goto('/auth')
    // CardTitle is a div, not a heading role
    await expect(page.getByText('Welcome back')).toBeVisible()
    await expect(page.getByPlaceholder('Email')).toBeVisible()
    await expect(page.getByPlaceholder('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('toggle to signup shows display name and create account', async ({ page }) => {
    await page.goto('/auth')
    await page.getByRole('button', { name: /don't have an account/i }).click()
    await expect(page.getByText('Create your account')).toBeVisible()
    await expect(page.getByPlaceholder('Display name')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
  })
})
