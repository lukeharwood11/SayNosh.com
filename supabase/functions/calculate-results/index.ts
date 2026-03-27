import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { handleOptions, json } from '../_shared/http.ts'
import { requireAuth } from '../_shared/auth.ts'

interface ScoredRestaurant {
  id: string
  name: string
  rating: number | null
  price_level: number | null
  image_url: string | null
  address: string | null
  match_type: 'strong' | 'soft' | 'none'
  yes_count: number
  no_count: number
}

/**
 * Scores restaurants using the spec's matching algorithm:
 *   - Any "no" → eliminated
 *   - All "yes" → Strong Match
 *   - Mix of "yes" + "neutral" (≥1 yes, 0 no) → Soft Match
 *
 * Outcome:
 *   - 1+ matches → complete with top winner and return all matched options
 *   - 0 matches → fallback to highest-rated non-eliminated, then top overall
 *   - If any strong matches exist, soft matches are excluded from returned matches
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
      auto_pick?: boolean
    }

    if (!body.session_id) return json({ error: 'session_id is required' }, 400)

    const { data: session, error: sErr } = await admin
      .from('sessions')
      .select('id, status, host_id, winner_restaurant_id')
      .eq('id', body.session_id)
      .maybeSingle()

    if (sErr || !session) return json({ error: 'Session not found' }, 404)
    if (!['swiping', 'round_two', 'completed'].includes(session.status)) {
      return json({ error: 'Session is not in a scoreable state' }, 400)
    }

    const isAlreadyCompleted = session.status === 'completed'
    const isHost = user.id === session.host_id

    let round = session.status === 'round_two' ? 2 : 1
    if (isAlreadyCompleted) {
      const { count } = await admin
        .from('restaurants')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', session.id)
        .eq('round', 2)
      round = (count ?? 0) > 0 ? 2 : 1
    }

    // Verify caller is a participant
    const { data: callerMember } = await admin
      .from('session_members')
      .select('id')
      .eq('session_id', session.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!callerMember) return json({ error: 'Not a member of this session' }, 403)

    // Active (non-skipped) members
    let { data: activeMembers } = await admin
      .from('session_members')
      .select('id, has_submitted')
      .eq('session_id', session.id)
      .eq('is_skipped', false)

    if ((!activeMembers || activeMembers.length === 0) && isAlreadyCompleted && session.winner_restaurant_id) {
      const { data: winnerRestaurant } = await admin
        .from('restaurants')
        .select('id, name, rating, price_level, image_url, address')
        .eq('id', session.winner_restaurant_id)
        .maybeSingle()

      if (winnerRestaurant) {
        return json({
          status: 'completed',
          round,
          match_type: 'fallback',
          winner: {
            id: winnerRestaurant.id,
            name: winnerRestaurant.name,
            match_type: 'none',
            rating: winnerRestaurant.rating,
            price_level: winnerRestaurant.price_level,
            image_url: winnerRestaurant.image_url,
            address: winnerRestaurant.address,
          },
          matches: [],
        })
      }
    }

    if (!activeMembers || activeMembers.length === 0) {
      return json({ error: 'No active members' }, 400)
    }

    const notDone = activeMembers.filter((m) => !m.has_submitted)

    if (notDone.length > 0 && !isAlreadyCompleted) {
      if (!isHost) {
        return json({ error: 'Not all members have submitted' }, 400)
      }
      // Host override: auto-skip members who haven't finished
      const skipIds = notDone.map((m) => m.id)
      await admin
        .from('session_members')
        .update({ is_skipped: true })
        .in('id', skipIds)

      const { data: refreshedActiveMembers } = await admin
        .from('session_members')
        .select('id, has_submitted')
        .eq('session_id', session.id)
        .eq('is_skipped', false)

      activeMembers = refreshedActiveMembers ?? []
    }

    const submittedMembers = activeMembers.filter((m) => m.has_submitted)
    const memberCount = submittedMembers.length || Math.max(1, activeMembers.length)
    const activeMemberIds = submittedMembers.map((m) => m.id)

    // Restaurants for this round
    const { data: restaurants } = await admin
      .from('restaurants')
      .select('id, name, rating, price_level, image_url, address')
      .eq('session_id', session.id)
      .eq('round', round)

    if (!restaurants || restaurants.length === 0) {
      return json({ error: 'No restaurants found for this round' }, 400)
    }

    // Swipes for this round from active members
    const swipes = activeMemberIds.length > 0
      ? (await admin
        .from('swipes')
        .select('restaurant_id, member_id, vote')
        .eq('session_id', session.id)
        .eq('round', round)
        .in('member_id', activeMemberIds)).data
      : []

    // Group swipe counts by restaurant
    const swipeMap = new Map<string, { yes: number; no: number; neutral: number }>()
    for (const s of swipes ?? []) {
      if (!swipeMap.has(s.restaurant_id)) {
        swipeMap.set(s.restaurant_id, { yes: 0, no: 0, neutral: 0 })
      }
      const c = swipeMap.get(s.restaurant_id)!
      if (s.vote === 'yes') c.yes++
      else if (s.vote === 'no') c.no++
      else c.neutral++
    }

    // Score each restaurant (missing votes treated as neutral)
    const scored: ScoredRestaurant[] = restaurants.map((r) => {
      const raw = swipeMap.get(r.id) ?? { yes: 0, no: 0, neutral: 0 }
      const totalVotes = raw.yes + raw.no + raw.neutral
      const neutralWithMissing = raw.neutral + Math.max(0, memberCount - totalVotes)

      let match_type: 'strong' | 'soft' | 'none'
      if (raw.no > 0) {
        match_type = 'none'
      } else if (raw.yes === memberCount) {
        match_type = 'strong'
      } else if (raw.yes > 0) {
        match_type = 'soft'
      } else {
        match_type = 'none' // all neutral — no conviction
      }

      return {
        id: r.id,
        name: r.name,
        rating: r.rating,
        price_level: r.price_level,
        image_url: r.image_url,
        address: r.address,
        match_type,
        yes_count: raw.yes,
        no_count: raw.no,
      }
    })

    const allMatches = scored
      .filter((r) => r.match_type !== 'none')
      .sort((a, b) => {
        if (a.match_type === 'strong' && b.match_type !== 'strong') return -1
        if (b.match_type === 'strong' && a.match_type !== 'strong') return 1
        if (b.yes_count !== a.yes_count) return b.yes_count - a.yes_count
        return (b.rating ?? 0) - (a.rating ?? 0)
      })

    const hasStrongMatches = allMatches.some((r) => r.match_type === 'strong')
    const matches = hasStrongMatches
      ? allMatches.filter((r) => r.match_type === 'strong')
      : allMatches

    const pick = (r: ScoredRestaurant) => ({
      id: r.id,
      name: r.name,
      match_type: r.match_type,
      rating: r.rating,
      price_level: r.price_level,
      image_url: r.image_url,
      address: r.address,
    })

    let winner: ScoredRestaurant | null = null

    if (matches.length === 0) {
      // Fallback: fewest no votes → highest rating → first alphabetically
      scored.sort((a, b) => {
        if (a.no_count !== b.no_count) return a.no_count - b.no_count
        return (b.rating ?? 0) - (a.rating ?? 0)
      })
      winner = scored[0]
    } else {
      winner = matches[0]
    }

    if (winner && !isAlreadyCompleted) {
      await admin
        .from('sessions')
        .update({ status: 'completed', winner_restaurant_id: winner.id })
        .eq('id', session.id)
    }

    const topMatchType: 'strong' | 'soft' | 'fallback' =
      winner?.match_type === 'strong' ? 'strong'
        : winner?.match_type === 'soft' ? 'soft'
        : 'fallback'

    return json({
      status: 'completed',
      round,
      match_type: topMatchType,
      winner: winner ? pick(winner) : null,
      matches: matches.map(pick),
    })
  } catch (e) {
    console.error('calculate-results', e)
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500)
  }
})
