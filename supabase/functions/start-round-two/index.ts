import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { handleOptions, json } from '../_shared/http.ts'
import { requireAuth } from '../_shared/auth.ts'

/**
 * Host-only: copies matched restaurants as round=2, resets has_submitted for
 * all active members, sets session status to round_two.
 * If only 1 restaurant is passed, skips directly to completed with that winner.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions()
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const auth = await requireAuth(req)
    if (auth instanceof Response) return auth
    const { user, admin } = auth

    const body = (await req.json()) as {
      session_id?: string
      restaurant_ids?: string[]
    }

    if (
      !body.session_id ||
      !Array.isArray(body.restaurant_ids) ||
      body.restaurant_ids.length === 0
    ) {
      return json({ error: 'session_id and non-empty restaurant_ids are required' }, 400)
    }

    const { data: session } = await admin
      .from('sessions')
      .select('id, host_id, status')
      .eq('id', body.session_id)
      .maybeSingle()

    if (!session) return json({ error: 'Session not found' }, 404)
    if (session.host_id !== user.id) {
      return json({ error: 'Only the host can start Round 2' }, 403)
    }
    if (session.status !== 'swiping') {
      return json({ error: 'Round 2 can only be started from the swiping state' }, 400)
    }

    // Edge case: 1 restaurant → skip Round 2, go directly to reveal
    if (body.restaurant_ids.length === 1) {
      await admin
        .from('sessions')
        .update({ status: 'completed', winner_restaurant_id: body.restaurant_ids[0] })
        .eq('id', session.id)

      return json({ status: 'completed', winner_restaurant_id: body.restaurant_ids[0] })
    }

    // Fetch source restaurants to copy as round 2
    const { data: sources } = await admin
      .from('restaurants')
      .select('external_id, name, address, image_url, rating, price_level, is_open_now')
      .eq('session_id', session.id)
      .in('id', body.restaurant_ids)

    if (!sources || sources.length === 0) {
      return json({ error: 'No matching restaurants found' }, 400)
    }

    const { error: insErr } = await admin.from('restaurants').insert(
      sources.map((r) => ({
        session_id: session.id,
        external_id: r.external_id,
        name: r.name,
        address: r.address,
        image_url: r.image_url,
        rating: r.rating,
        price_level: r.price_level,
        is_open_now: r.is_open_now,
        round: 2,
      })),
    )

    if (insErr) {
      console.error('start-round-two insert restaurants', insErr)
      return json({ error: 'Could not create Round 2 restaurants' }, 500)
    }

    // Reset has_submitted for all active members
    await admin
      .from('session_members')
      .update({ has_submitted: false })
      .eq('session_id', session.id)
      .eq('is_skipped', false)

    const { error: statusErr } = await admin
      .from('sessions')
      .update({ status: 'round_two' })
      .eq('id', session.id)

    if (statusErr) {
      console.error('start-round-two update status', statusErr)
      return json({ error: 'Could not update session status' }, 500)
    }

    return json({ status: 'round_two' })
  } catch (e) {
    console.error('start-round-two', e)
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500)
  }
})
