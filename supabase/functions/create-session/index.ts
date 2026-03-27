import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { displayNameFromUser } from '../_shared/profile.ts'
import { handleOptions, json } from '../_shared/http.ts'
import { requireAuth } from '../_shared/auth.ts'

function randomInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const buf = new Uint8Array(6)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => chars[b % chars.length]).join('')
}

const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
}

const FOOD_FILTER_TYPES: Record<string, string[]> = {
  American: ['american_restaurant'],
  Bakery: ['bakery'],
  Chinese: ['chinese_restaurant'],
  Coffee: ['cafe', 'coffee_shop'],
  'Fast Food': ['fast_food_restaurant'],
  Indian: ['indian_restaurant'],
  Italian: ['italian_restaurant'],
  Japanese: ['japanese_restaurant', 'sushi_restaurant'],
  Korean: ['korean_restaurant'],
  Mediterranean: ['mediterranean_restaurant'],
  Mexican: ['mexican_restaurant'],
  Pizza: ['pizza_restaurant'],
  Seafood: ['seafood_restaurant'],
  Thai: ['thai_restaurant'],
  Vegetarian: ['vegetarian_restaurant', 'vegan_restaurant'],
  Vietnamese: ['vietnamese_restaurant'],
}

const MEAL_TYPE_DEFAULTS: Record<string, string[]> = {
  dinner: [
    'restaurant',
    'american_restaurant',
    'italian_restaurant',
    'japanese_restaurant',
    'mexican_restaurant',
    'steak_house',
    'seafood_restaurant',
    'mediterranean_restaurant',
    'chinese_restaurant',
    'indian_restaurant',
    'thai_restaurant',
    'korean_restaurant',
    'vietnamese_restaurant',
  ],
  quick: [
    'fast_food_restaurant',
    'sandwich_shop',
    'pizza_restaurant',
    'hamburger_restaurant',
    'meal_takeaway',
  ],
  coffee: [
    'cafe',
    'coffee_shop',
    'bakery',
    'ice_cream_shop',
  ],
  any: [
    'restaurant',
    'american_restaurant',
    'fast_food_restaurant',
    'cafe',
    'coffee_shop',
    'bakery',
    'italian_restaurant',
    'japanese_restaurant',
    'mexican_restaurant',
    'pizza_restaurant',
    'sandwich_shop',
  ],
}

const ALL_DEFAULT_TYPES = [...new Set(Object.values(MEAL_TYPE_DEFAULTS).flat())]

const ALLOWED_FOOD_TYPES = new Set<string>([
  ...ALL_DEFAULT_TYPES,
  ...Object.values(FOOD_FILTER_TYPES).flat(),
  'barbecue_restaurant',
  'breakfast_restaurant',
  'brunch_restaurant',
  'hamburger_restaurant',
  'ice_cream_shop',
  'meal_delivery',
  'meal_takeaway',
  'ramen_restaurant',
  'sandwich_shop',
  'steak_house',
])

const EXCLUDED_PLACE_TYPES = new Set<string>([
  'gas_station',
  'convenience_store',
  'grocery_store',
  'supermarket',
  'market',
  'department_store',
  'discount_store',
  'warehouse_store',
  'drugstore',
  'pharmacy',
  'liquor_store',
  'pet_store',
  'hardware_store',
  'home_goods_store',
  'clothing_store',
  'book_store',
  'electronics_store',
  'furniture_store',
  'gift_shop',
  'shopping_mall',
  'truck_stop',
])

function resolveIncludedTypes(cuisines?: string[], mealType = 'dinner'): string[] {
  const includedTypes = new Set<string>()

  for (const cuisine of cuisines ?? []) {
    for (const type of FOOD_FILTER_TYPES[cuisine] ?? []) {
      includedTypes.add(type)
    }
  }

  if (includedTypes.size > 0) return Array.from(includedTypes)

  return MEAL_TYPE_DEFAULTS[mealType] ?? MEAL_TYPE_DEFAULTS.dinner
}

function normalizeRestaurantName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function dedupeKeyFromName(name: string): string {
  let normalized = normalizeRestaurantName(name)
  if (!normalized) return normalized

  // Collapse common chain suffix variants: "Brand #123", "Brand 123"
  normalized = normalized
    .replace(/\b#\s*\d+[a-z]?\b/g, ' ')
    .replace(/\b(?:store|location|branch)\s*\d*[a-z]?\b/g, ' ')
    .replace(/\s+\d+[a-z]?$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized
}

/** Hostname only, lowercased, no leading www — for matching chain locations by site. */
function normalizeWebsiteDomain(websiteUri: string | null | undefined): string | null {
  if (websiteUri == null || typeof websiteUri !== 'string') return null
  const trimmed = websiteUri.trim()
  if (!trimmed) return null
  try {
    const url = trimmed.includes('://') ? new URL(trimmed) : new URL(`https://${trimmed}`)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    let host = url.hostname.toLowerCase()
    if (host.startsWith('www.')) host = host.slice(4)
    if (!host || host === 'localhost') return null
    return host
  } catch {
    return null
  }
}

type RestaurantCandidate = {
  external_id: string
  name: string
  address: string | null
  image_url: string | null
  rating: number | null
  price_level: number | null
  is_open_now: boolean | null
  round: number
  website_uri: string | null
  distance_meters: number
}

function clusterKeyForCandidate(row: RestaurantCandidate): string {
  const domain = normalizeWebsiteDomain(row.website_uri)
  if (domain) return `domain:${domain}`
  const nameKey = dedupeKeyFromName(row.name)
  if (nameKey) return `name:${nameKey}`
  return `id:${row.external_id}`
}

function pickPreferredRestaurantCandidate(a: RestaurantCandidate, b: RestaurantCandidate): RestaurantCandidate {
  const aCustom = a.external_id.startsWith('custom:')
  const bCustom = b.external_id.startsWith('custom:')

  if (a.distance_meters !== b.distance_meters) {
    return a.distance_meters <= b.distance_meters ? a : b
  }

  if (aCustom && !bCustom) return b
  if (!aCustom && bCustom) return a
  return a
}

/** Merge by website domain (closest wins) or by normalized name (closest wins; Google beats custom on tie). */
function dedupeRestaurantCandidates(rows: RestaurantCandidate[]): RestaurantCandidate[] {
  const deduped = new Map<string, RestaurantCandidate>()

  for (const row of rows) {
    const key = clusterKeyForCandidate(row)
    const existing = deduped.get(key)
    if (!existing) {
      deduped.set(key, row)
      continue
    }
    deduped.set(key, pickPreferredRestaurantCandidate(existing, row))
  }

  return Array.from(deduped.values())
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusMeters = 6_371_000
  const toRadians = (degrees: number) => degrees * (Math.PI / 180)

  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function isFoodPlace(place: { primaryType?: string; types?: string[] }): boolean {
  const types = new Set<string>([
    ...(place.primaryType ? [place.primaryType] : []),
    ...(place.types ?? []),
  ])

  for (const type of types) {
    if (EXCLUDED_PLACE_TYPES.has(type)) return false
  }

  // Strong guard: if Google says the primary type is non-food, reject it
  // even if one of the secondary tags is food-adjacent (e.g. grocery + cafe).
  if (place.primaryType && !ALLOWED_FOOD_TYPES.has(place.primaryType)) {
    return false
  }

  for (const type of types) {
    if (ALLOWED_FOOD_TYPES.has(type)) return true
  }

  return false
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions()
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const auth = await requireAuth(req)
    if (auth instanceof Response) return auth
    const { user, admin } = auth

    const body = (await req.json()) as {
      city?: string
      state?: string
      lat?: number
      lng?: number
      radius?: number
      cuisines?: string[]
      custom_options?: string[]
      meal_type?: string
      price_levels?: number[]
      open_now?: boolean
    }

    const city =
      typeof body.city === 'string' ? body.city.trim().slice(0, 80) : ''
    const state =
      typeof body.state === 'string' ? body.state.trim().toUpperCase().slice(0, 2) : ''

    if (!city || !/^[A-Z]{2}$/.test(state)) {
      return json({ error: 'City and state are required' }, 400)
    }
    if (typeof body.radius !== 'number' || body.radius <= 0) {
      return json({ error: 'Invalid search radius' }, 400)
    }

    const hasPreResolvedCoords =
      typeof body.lat === 'number' && typeof body.lng === 'number' &&
      body.lat >= -90 && body.lat <= 90 && body.lng >= -180 && body.lng <= 180

    // Deduplicate and sanitize custom options (max 20, 120 chars each)
    const rawCustom = Array.isArray(body.custom_options) ? body.custom_options : []
    const seen = new Set<string>()
    const customNames: string[] = []
    for (const item of rawCustom) {
      if (typeof item !== 'string') continue
      const t = item.trim().slice(0, 120)
      if (!t) continue
      const key = t.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      customNames.push(t)
      if (customNames.length >= 20) break
    }

    const fromGoogle: RestaurantCandidate[] = []

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
    let searchLat: number | null = null
    let searchLng: number | null = null

    if (hasPreResolvedCoords) {
      searchLat = body.lat!
      searchLng = body.lng!
    } else if (apiKey) {
      const addressQuery = [city, state].filter(Boolean).join(', ')
      try {
        const geoUrl =
          `https://maps.googleapis.com/maps/api/geocode/json?address=${
            encodeURIComponent(addressQuery)
          }&key=${apiKey}`
        const geoRes = await fetch(geoUrl)
        if (geoRes.ok) {
          const geoData = (await geoRes.json()) as {
            status: string
            results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>
            error_message?: string
          }
          if (geoData.status === 'OK' && geoData.results?.[0]?.geometry?.location) {
            const loc = geoData.results[0].geometry.location
            searchLat = loc.lat
            searchLng = loc.lng
          } else {
            console.error('Geocoding failed', geoData.status, geoData.error_message)
          }
        }
      } catch (err) {
        console.error('Geocoding fetch failed', err)
      }
    }

    if (apiKey && searchLat != null && searchLng != null) {
      try {
        const mealType = typeof body.meal_type === 'string' && body.meal_type in MEAL_TYPE_DEFAULTS
          ? body.meal_type
          : 'dinner'
        const includedTypes = resolveIncludedTypes(body.cuisines, mealType)
        const placesRes = await fetch(
          'https://places.googleapis.com/v1/places:searchNearby',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': [
                'places.id',
                'places.displayName',
                'places.location',
                'places.rating',
                'places.priceLevel',
                'places.primaryType',
                'places.photos',
                'places.formattedAddress',
                'places.regularOpeningHours',
                'places.types',
                'places.websiteUri',
              ].join(','),
            },
            body: JSON.stringify({
              includedTypes,
              excludedTypes: Array.from(EXCLUDED_PLACE_TYPES),
              maxResultCount: 20,
              locationRestriction: {
                circle: {
                  center: { latitude: searchLat, longitude: searchLng },
                  radius: body.radius,
                },
              },
              rankPreference: 'POPULARITY',
            }),
          },
        )

        if (placesRes.ok) {
          const data = await placesRes.json()
          const byRestaurantName = new Map<string, {
            external_id: string
            name: string
            address: string | null
            image_url: string | null
            rating: number | null
            price_level: number | null
            is_open_now: boolean | null
            round: number
            website_uri: string | null
            distance_meters: number
          }>()

          for (const place of data.places ?? []) {
            if (!isFoodPlace(place)) continue

            const name = place.displayName?.text ?? 'Unknown'
            const normalizedName = dedupeKeyFromName(name)
            if (!normalizedName) continue

            const distance =
              typeof place.location?.latitude === 'number' && typeof place.location?.longitude === 'number'
                ? distanceMeters(
                  searchLat,
                  searchLng,
                  place.location.latitude,
                  place.location.longitude,
                )
                : Number.POSITIVE_INFINITY

            const websiteUri =
              typeof place.websiteUri === 'string' && place.websiteUri.trim()
                ? place.websiteUri.trim()
                : null

            const next = {
              external_id: place.id,
              name,
              address: place.formattedAddress ?? null,
              image_url: place.photos?.[0]?.name
                ? `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxHeightPx=400&maxWidthPx=400&key=${apiKey}`
                : null,
              rating: typeof place.rating === 'number' ? place.rating : null,
              price_level: PRICE_LEVELS[place.priceLevel] ?? null,
              is_open_now: place.regularOpeningHours?.openNow ?? null,
              round: 1,
              website_uri: websiteUri,
              distance_meters: distance,
            }

            const existing = byRestaurantName.get(normalizedName)
            if (!existing || next.distance_meters < existing.distance_meters) {
              byRestaurantName.set(normalizedName, next)
            }
          }

          const allowedPrices = Array.isArray(body.price_levels) && body.price_levels.length > 0
            ? new Set(body.price_levels.filter((v) => typeof v === 'number'))
            : null
          const filterOpenNow = body.open_now === true

          for (const place of byRestaurantName.values()) {
            if (allowedPrices && place.price_level != null && !allowedPrices.has(place.price_level)) {
              continue
            }
            if (filterOpenNow && place.is_open_now === false) {
              continue
            }
            fromGoogle.push(place)
          }
        } else {
          console.error('Places API error', placesRes.status, await placesRes.text())
        }
      } catch (err) {
        console.error('Places API fetch failed', err)
      }
    } else if (apiKey && (searchLat == null || searchLng == null)) {
      console.error('Skipping Nearby Search: could not geocode', city, state)
    }

    const fromCustom: RestaurantCandidate[] = customNames.map((name) => ({
      external_id: `custom:${crypto.randomUUID()}`,
      name,
      address: null as string | null,
      image_url: null as string | null,
      rating: null as number | null,
      price_level: null as number | null,
      is_open_now: null as boolean | null,
      round: 1,
      website_uri: null,
      distance_meters: Number.POSITIVE_INFINITY,
    }))

    const rows = dedupeRestaurantCandidates([...fromGoogle, ...fromCustom])
    if (rows.length <= 1) {
      return json(
        {
          error:
            'Not enough restaurants match your filters to start a session. Try a wider search radius, more cuisines or price levels, turning off \'Open now\', or adding custom spots.',
        },
        404,
      )
    }

    const filters = {
      city,
      state,
      radius: body.radius,
      cuisines: body.cuisines ?? null,
      meal_type: body.meal_type ?? 'dinner',
      price_levels: body.price_levels ?? null,
      open_now: body.open_now ?? null,
      ...(searchLat != null && searchLng != null ? { lat: searchLat, lng: searchLng } : {}),
    }

    const displayName = displayNameFromUser(user) || 'Host'

    let sessionId: string | null = null
    for (let attempt = 0; attempt < 10; attempt++) {
      const invite_code = randomInviteCode()
      const { data: session, error: sErr } = await admin
        .from('sessions')
        .insert({ host_id: user.id, invite_code, filters, status: 'waiting' })
        .select('id')
        .single()

      if (session?.id) {
        sessionId = session.id
        break
      }
      if (sErr?.code !== '23505') {
        console.error('create-session insert session', sErr)
        return json({ error: 'Could not create session' }, 500)
      }
    }

    if (!sessionId) return json({ error: 'Could not create session' }, 500)

    const { error: mErr } = await admin.from('session_members').insert({
      session_id: sessionId,
      user_id: user.id,
      display_name: displayName,
    })
    if (mErr) {
      console.error('create-session insert member', mErr)
      await admin.from('sessions').delete().eq('id', sessionId)
      return json({ error: 'Could not create session' }, 500)
    }

    const { error: rErr } = await admin.from('restaurants').insert(
      rows.map(({ website_uri: _w, distance_meters: _d, ...r }) => ({ ...r, session_id: sessionId! })),
    )
    if (rErr) {
      console.error('create-session insert restaurants', rErr)
      await admin.from('sessions').delete().eq('id', sessionId)
      return json({ error: 'Could not save places for this session' }, 500)
    }

    return json({ session_id: sessionId })
  } catch (e) {
    console.error('create-session', e)
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500)
  }
})
