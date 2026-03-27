import { test as base, type Page } from '@playwright/test'

/**
 * Two isolated browser contexts (two Supabase sessions) for realtime / multi-user flows.
 * Depends on auth.setup.ts + auth-b.setup.ts having written storage state files.
 */
export const multiplayerTest = base.extend<{ hostPage: Page; guestPage: Page }>({
  hostPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/user.json' })
    const page = await ctx.newPage()
    await use(page)
    await ctx.close()
  },
  guestPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/user-b.json' })
    const page = await ctx.newPage()
    await use(page)
    await ctx.close()
  },
})
