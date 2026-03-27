import { test, expect } from '@playwright/test'

test.describe('authenticated shell', () => {
  test('dashboard greeting and bottom navigation', async ({ page }) => {
    await page.goto('/app')
    await expect(page).toHaveURL(/\/app\/?$/)
    await expect(page.getByText(/^Hey .+! Ready to figure out where to eat\?$/)).toBeVisible()

    await page.getByRole('link', { name: 'History' }).click()
    await expect(page).toHaveURL(/\/app\/history$/)

    await page.getByRole('link', { name: 'Friends' }).click()
    await expect(page).toHaveURL(/\/app\/friends$/)

    await page.getByRole('link', { name: 'Profile' }).click()
    await expect(page).toHaveURL(/\/app\/profile$/)

    await page.getByRole('link', { name: 'Home' }).click()
    await expect(page).toHaveURL(/\/app\/?$/)
  })

  test('profile, history, and friends headers render', async ({ page }) => {
    await page.goto('/app/profile')
    await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()

    await page.goto('/app/history')
    await expect(page.getByRole('heading', { name: 'History', level: 1 })).toBeVisible()
    await expect(page.getByPlaceholder('Search by restaurant, invite code, or person')).toBeVisible()

    await page.goto('/app/friends')
    await expect(page.getByRole('heading', { name: 'Friends', level: 1 })).toBeVisible()
  })

  test('create session and join screens load', async ({ page }) => {
    await page.goto('/create')
    await expect(page.getByRole('heading', { name: 'New Session', level: 1 })).toBeVisible()

    await page.goto('/join/NX42AB')
    await expect(page.getByRole('heading', { name: 'Join Session', level: 1 })).toBeVisible()
    await expect(page.getByPlaceholder('e.g. NX42')).toHaveValue('NX42AB')
  })
})
