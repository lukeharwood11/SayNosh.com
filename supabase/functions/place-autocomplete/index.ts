import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { handleOptions, json } from '../_shared/http.ts'
import { requireAuth } from '../_shared/auth.ts'

interface AutocompleteRequest {
  input: string
}

interface PlaceDetailsRequest {
  place_id: string
}

interface ReverseGeocodeRequest {
  lat: number
  lng: number
}

type RequestBody = AutocompleteRequest | PlaceDetailsRequest | ReverseGeocodeRequest

function isAutocomplete(b: RequestBody): b is AutocompleteRequest {
  return 'input' in b && typeof (b as AutocompleteRequest).input === 'string'
}

function isPlaceDetails(b: RequestBody): b is PlaceDetailsRequest {
  return 'place_id' in b && typeof (b as PlaceDetailsRequest).place_id === 'string'
}

function isReverseGeocode(b: RequestBody): b is ReverseGeocodeRequest {
  return (
    'lat' in b &&
    'lng' in b &&
    typeof (b as ReverseGeocodeRequest).lat === 'number' &&
    typeof (b as ReverseGeocodeRequest).lng === 'number'
  )
}

function extractCityState(
  components: Array<{ long_name: string; short_name: string; types: string[] }>,
): { city: string; state: string } {
  let city = ''
  let state = ''
  for (const c of components) {
    if (c.types.includes('locality')) city = c.long_name
    if (!city && c.types.includes('sublocality_level_1')) city = c.long_name
    if (!city && c.types.includes('administrative_area_level_3')) city = c.long_name
    if (c.types.includes('administrative_area_level_1')) state = c.short_name
  }
  return { city, state }
}

async function handleAutocomplete(apiKey: string, input: string) {
  const trimmed = input.trim()
  if (!trimmed || trimmed.length > 200) {
    return json({ predictions: [] })
  }

  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
    },
    body: JSON.stringify({
      input: trimmed,
      includedRegionCodes: ['us'],
      includedPrimaryTypes: [
        'locality',
        'postal_code',
        'sublocality',
        'administrative_area_level_3',
      ],
    }),
  })

  if (!res.ok) {
    console.error('Places Autocomplete error', res.status, await res.text())
    return json({ error: 'Autocomplete request failed' }, 502)
  }

  const data = await res.json()
  const predictions = (data.suggestions ?? [])
    .filter((s: Record<string, unknown>) => s.placePrediction)
    .slice(0, 5)
    .map((s: Record<string, unknown>) => {
      const p = s.placePrediction as Record<string, unknown>
      const structured = p.structuredFormat as Record<string, Record<string, string>> | undefined
      return {
        placeId: p.placeId as string,
        mainText: structured?.mainText?.text ?? '',
        secondaryText: structured?.secondaryText?.text ?? '',
      }
    })

  return json({ predictions })
}

async function handlePlaceDetails(apiKey: string, placeId: string) {
  if (!placeId || placeId.length > 300) {
    return json({ error: 'Invalid place_id' }, 400)
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${
    encodeURIComponent(placeId)
  }&key=${apiKey}`

  const res = await fetch(url)
  if (!res.ok) {
    console.error('Geocoding (place_id) error', res.status, await res.text())
    return json({ error: 'Geocoding request failed' }, 502)
  }

  const data = (await res.json()) as {
    status: string
    results?: Array<{
      geometry?: { location?: { lat: number; lng: number } }
      address_components?: Array<{ long_name: string; short_name: string; types: string[] }>
      formatted_address?: string
    }>
  }

  if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) {
    return json({ error: 'Could not resolve location' }, 404)
  }

  const result = data.results[0]
  const loc = result.geometry!.location!
  const { city, state } = extractCityState(result.address_components ?? [])
  const label = city && state ? `${city}, ${state}` : result.formatted_address ?? ''

  return json({ lat: loc.lat, lng: loc.lng, city, state, label })
}

async function handleReverseGeocode(apiKey: string, lat: number, lng: number) {
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return json({ error: 'Invalid coordinates' }, 400)
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) {
    console.error('Reverse geocode error', res.status, await res.text())
    return json({ error: 'Reverse geocode request failed' }, 502)
  }

  const data = (await res.json()) as {
    status: string
    results?: Array<{
      address_components?: Array<{ long_name: string; short_name: string; types: string[] }>
      formatted_address?: string
    }>
  }

  if (data.status !== 'OK' || !data.results?.length) {
    console.error('Reverse geocode status:', data.status, JSON.stringify(data))
    return json({ error: 'Could not determine location' }, 404)
  }

  const result = data.results[0]
  const { city, state } = extractCityState(result.address_components ?? [])
  const label = city && state ? `${city}, ${state}` : result.formatted_address ?? ''

  return json({ lat, lng, city, state, label })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions()
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const auth = await requireAuth(req)
    if (auth instanceof Response) return auth

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
    if (!apiKey) return json({ error: 'Server misconfigured' }, 500)

    const body = (await req.json()) as RequestBody

    if (isAutocomplete(body)) {
      return await handleAutocomplete(apiKey, body.input)
    }
    if (isPlaceDetails(body)) {
      return await handlePlaceDetails(apiKey, body.place_id)
    }
    if (isReverseGeocode(body)) {
      return await handleReverseGeocode(apiKey, body.lat, body.lng)
    }

    return json({ error: 'Invalid request. Provide { input }, { place_id }, or { lat, lng }.' }, 400)
  } catch (e) {
    console.error('place-autocomplete', e)
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500)
  }
})
