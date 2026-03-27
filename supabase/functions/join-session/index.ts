import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { displayNameFromUser } from '../_shared/profile.ts'
import { handleOptions, json } from '../_shared/http.ts'
import { requireAuth } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions()
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const auth = await requireAuth(req)
    if (auth instanceof Response) return auth
    const { user, admin } = auth

    const displayName = displayNameFromUser(user)
    if (!displayName) {
      return json({ error: 'Add a display name in your profile before joining.' }, 400)
    }

    const body = (await req.json()) as { invite_code?: string }
    const code = typeof body.invite_code === 'string' ? body.invite_code.trim().toUpperCase() : ''
    if (!code) return json({ error: 'Invite code is required' }, 400)

    const { data: session, error: sErr } = await admin
      .from('sessions')
      .select('id, status')
      .eq('invite_code', code)
      .maybeSingle()

    if (sErr || !session) return json({ error: 'Invalid invite code' }, 404)
    if (session.status !== 'waiting') {
      return json({ error: 'This session is no longer accepting new members' }, 400)
    }

    const { data: existing } = await admin
      .from('session_members')
      .select('id')
      .eq('session_id', session.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) return json({ session_id: session.id })

    const { error: mErr } = await admin.from('session_members').insert({
      session_id: session.id,
      user_id: user.id,
      display_name: displayName,
    })

    if (mErr) {
      console.error('join-session insert member', mErr)
      return json({ error: 'Could not join session' }, 500)
    }

    return json({ session_id: session.id })
  } catch (e) {
    console.error('join-session', e)
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500)
  }
})
