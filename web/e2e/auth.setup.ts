import { test as setup, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const authFile = path.join(process.cwd(), 'playwright', '.auth', 'user.json')

setup('sign in and persist session', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL?.trim()
  const password = process.env.E2E_TEST_PASSWORD
  if (!email || !password) {
    throw new Error('E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set for the setup project')
  }

  await mkdir(path.dirname(authFile), { recursive: true })

  await page.goto('/auth')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/app\/?$/, { timeout: 30_000 })

  await page.context().storageState({ path: authFile })
})
