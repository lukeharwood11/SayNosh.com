import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Denver — used with Playwright geolocation override for create-session. */
export const DENVER_GEO = { latitude: 39.7392, longitude: -104.9903 }

export async function grantDenverGeolocation(page: Page) {
  await page.context().grantPermissions(['geolocation'])
  await page.context().setGeolocation(DENVER_GEO)
}

/**
 * Reverse geocode from "Use my location" calls the place-autocomplete edge function,
 * which needs GOOGLE_PLACES_API_KEY. Stub lat/lng responses so local E2E works without it.
 */
export async function stubPlaceAutocompleteReverseGeocode(page: Page) {
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

/** Geolocation + autocomplete stubs for host create flow; stub guest for parity if they hit edge functions. */
export async function prepareCreateSessionRoutes(hostPage: Page, guestPage: Page) {
  await grantDenverGeolocation(hostPage)
  await stubPlaceAutocompleteReverseGeocode(hostPage)
  await stubPlaceAutocompleteReverseGeocode(guestPage)
}

/**
 * Host-only: create a waiting session with two custom restaurants (no Places API dependency).
 * Call `prepareCreateSessionRoutes(host, guest)` first.
 * Returns the invite code from the waiting room.
 */
export async function createSessionWithTwoCustomSpots(hostPage: Page): Promise<string> {
  await hostPage.goto('/create')
  await hostPage.getByRole('button', { name: 'Use my location' }).click()
  await expect(hostPage.getByRole('button', { name: 'Start session' })).toBeEnabled({
    timeout: 60_000,
  })

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
  return (await inviteCodeLocator.innerText()).trim()
}

const SWIPE_INTERACTION_DELAY_MS = 450

/** Vote yes on every card until the swipe deck is gone (guest should finish before host for auto results). */
export async function swipeDeckAllYes(page: Page, maxCards = 80) {
  await page.waitForTimeout(SWIPE_INTERACTION_DELAY_MS)
  const yes = page.getByTestId('swipe-vote-yes')
  for (let i = 0; i < maxCards; i++) {
    if (!(await yes.isVisible().catch(() => false))) break
    await yes.click()
    await page.waitForTimeout(280)
  }
}
