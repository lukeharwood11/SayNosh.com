import { expect } from '@playwright/test'
import { multiplayerTest as test } from './fixtures/multiplayer'
import {
  createSessionWithTwoCustomSpots,
  prepareCreateSessionRoutes,
  swipeDeckAllYes,
} from './helpers/live-session'

test.describe('multiplayer session (Supabase realtime)', () => {
  test.describe.configure({ mode: 'serial' })

  test('seeds co-partners via join code so friends list works later', async ({ hostPage, guestPage }) => {
    await prepareCreateSessionRoutes(hostPage, guestPage)
    const inviteCode = await createSessionWithTwoCustomSpots(hostPage)

    await guestPage.goto(`/join/${inviteCode}`)
    await expect(guestPage.getByRole('button', { name: 'Join session' })).toBeEnabled({
      timeout: 15_000,
    })
    await guestPage.getByRole('button', { name: 'Join session' }).click()
    await expect(guestPage).toHaveURL(hostPage.url(), { timeout: 30_000 })

    await expect(hostPage.getByText('Members · 2')).toBeVisible({ timeout: 45_000 })
    await expect(guestPage.getByText(/waiting for the host to start swiping/i)).toBeVisible()

    await guestPage.goto('/app')
    await expect(guestPage).toHaveURL(/\/app\/?$/)
  })

  // Invite + swipe must run in one test: the multiplayer fixture closes contexts after each test,
  // so a separate test would not stay on the session URL.
  test('invite active friend, accept toast, then full swipe to strong match', async ({
    hostPage,
    guestPage,
  }) => {
    await prepareCreateSessionRoutes(hostPage, guestPage)
    await guestPage.goto('/app')
    await expect(guestPage).toHaveURL(/\/app\/?$/)

    await createSessionWithTwoCustomSpots(hostPage)

    const inviteBtn = hostPage.getByTestId('invite-friend-button')
    await expect(inviteBtn).toBeVisible({ timeout: 60_000 })
    await inviteBtn.click()

    const toast = guestPage.getByTestId('session-invite-toast')
    await expect(toast).toBeVisible({ timeout: 45_000 })
    await expect(toast.getByText(/invited you!/i)).toBeVisible()

    await guestPage.getByRole('button', { name: 'Accept' }).click()
    await expect(guestPage).toHaveURL(hostPage.url(), { timeout: 30_000 })

    await expect(hostPage.getByText('Members · 2')).toBeVisible({ timeout: 45_000 })

    await hostPage.getByRole('button', { name: 'Start swiping' }).click()

    const yesGuest = guestPage.getByTestId('swipe-vote-yes')
    const yesHost = hostPage.getByTestId('swipe-vote-yes')
    await expect(yesGuest).toBeVisible({ timeout: 60_000 })
    await expect(yesHost).toBeVisible({ timeout: 60_000 })

    await swipeDeckAllYes(guestPage)
    await expect(guestPage.getByText(/1 of 2 members have swiped/i)).toBeVisible({
      timeout: 30_000,
    })

    await swipeDeckAllYes(hostPage)

    const matchHeading = hostPage.getByRole('heading', { name: "It's a match!", level: 2 })
    await expect(matchHeading).toBeVisible({ timeout: 120_000 })
    await expect(guestPage.getByRole('heading', { name: "It's a match!", level: 2 })).toBeVisible({
      timeout: 120_000,
    })
  })
})
