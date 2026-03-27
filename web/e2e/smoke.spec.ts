import { test, expect } from '@playwright/test'

test.describe('marketing and static pages', () => {
  test('home shows headline and primary CTA', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'nosh', level: 1 })).toBeVisible()
    await expect(
      page.getByText('Where your group finally agrees on dinner.'),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible()
  })

  test('footer links open privacy and terms', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Privacy Policy' }).click()
    await expect(page).toHaveURL(/\/privacy$/)
    await expect(
      page.getByRole('heading', { name: 'Privacy Policy', level: 1 }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'What we collect', level: 2 })).toBeVisible()

    await page.goto('/')
    await page.getByRole('link', { name: 'Terms of Service' }).click()
    await expect(page).toHaveURL(/\/terms$/)
    await expect(
      page.getByRole('heading', { name: 'Terms of Service', level: 1 }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Using nosh', level: 2 })).toBeVisible()
  })

  test('unknown path redirects to home', async ({ page }) => {
    await page.goto('/this-route-does-not-exist')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'nosh', level: 1 })).toBeVisible()
  })
})
