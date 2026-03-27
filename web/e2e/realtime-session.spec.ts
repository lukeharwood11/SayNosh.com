import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { multiplayerTest as test } from './fixtures/multiplayer'

/** Denver — used with Playwright geolocation override for create-session. */
const GEO = { latitude: 39.7392, longitude: -104.9903 }

async function useMockGeolocation(page: Page) {
  await page.context().grantPermissions(['geolocation'])
  await page.context().setGeolocation(GEO)
}

/**
 * Reverse geocode from "Use my location" calls the place-autocomplete edge function,
 * which needs GOOGLE_PLACES_API_KEY. Stub lat/lng responses so local E2E works without it.
 */
async function stubPlaceAutocompleteReverseGeocode(page: Page) {
  await page.route('**/functions/v1/place-autocomplete', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS' || req.method() !== 'POST') {
      await route.continue()
      return
    }
    let body: unknown
    try {
      body = req.postDataJSON()
    } catch {
      await route.continue()
      return
    }
    if (
      body &&
      typeof body === 'object' &&
      'lat' in body &&
      'lng' in body &&
      typeof (body as { lat: unknown }).lat === 'number' &&
      typeof (body as { lng: unknown }).lng === 'number'
    ) {
      const { lat, lng } = body as { lat: number; lng: number }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          lat,
          lng,
          city: 'Denver',
          state: 'CO',
          label: 'Denver, CO',
        }),
      })
      return
    }
    await route.continue()
  })
}

test.describe('multiplayer session (Supabase realtime)', () => {
  test('host sees member join via postgres_changes on session_members', async ({
    hostPage,
    guestPage,
  }) => {
    test.setTimeout(180_000)

    await useMockGeolocation(hostPage)
    await stubPlaceAutocompleteReverseGeocode(hostPage)
    await stubPlaceAutocompleteReverseGeocode(guestPage)

    await hostPage.goto('/create')
    await hostPage.getByRole('button', { name: 'Use my location' }).click()
    await expect(hostPage.getByRole('button', { name: 'Start session' })).toBeEnabled({
      timeout: 60_000,
    })

    // create-session needs >1 restaurant row; without GOOGLE_PLACES_API_KEY, Places returns none.
    const customField = hostPage.getByPlaceholder(/Mom's lasagna|Tacos El Rey/i)
    await customField.fill('E2E Custom Spot Alpha')
    await hostPage.getByRole('button', { name: 'Add spot' }).click()
    await customField.fill('E2E Custom Spot Beta')
    await hostPage.getByRole('button', { name: 'Add spot' }).click()

    await hostPage.getByRole('button', { name: 'Start session' }).click()
    await expect(hostPage).toHaveURL(/\/session\/[0-9a-f-]+$/i, { timeout: 120_000 })

    await expect(hostPage.getByText('Members · 1')).toBeVisible({ timeout: 30_000 })

    const inviteCodeLocator = hostPage.getByTestId('session-invite-code')
    await expect(inviteCodeLocator).toHaveText(/^[A-Z2-9]{6}$/)
    const inviteCode = (await inviteCodeLocator.innerText()).trim()

    await guestPage.goto(`/join/${inviteCode}`)
    await expect(guestPage.getByRole('button', { name: 'Join session' })).toBeEnabled({
      timeout: 15_000,
    })
    await guestPage.getByRole('button', { name: 'Join session' }).click()
    await expect(guestPage).toHaveURL(hostPage.url(), { timeout: 30_000 })

    await expect(hostPage.getByText('Members · 2')).toBeVisible({ timeout: 45_000 })
    await expect(guestPage.getByText(/waiting for the host to start swiping/i)).toBeVisible()
  })
})
