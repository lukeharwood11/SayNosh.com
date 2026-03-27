import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { handleOptions, json } from '../_shared/http.ts'
import { requireAuth } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions()
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const auth = await requireAuth(req)
    if (auth instanceof Response) return auth
    const { user, admin } = auth

    const body = (await req.json()) as {
      session_id?: string
      invitee_user_id?: string
    }

    if (!body.session_id) return json({ error: 'session_id is required' }, 400)
    if (!body.invitee_user_id) return json({ error: 'invitee_user_id is required' }, 400)
    if (body.invitee_user_id === user.id) return json({ error: 'Cannot invite yourself' }, 400)

    const { data: session } = await admin
      .from('sessions')
      .select('id, status, host_id')
      .eq('id', body.session_id)
      .maybeSingle()

    if (!session) return json({ error: 'Session not found' }, 404)
    if (session.host_id !== user.id) return json({ error: 'Only the host can send invites' }, 403)
    if (session.status !== 'waiting') {
      return json({ error: 'Session is no longer accepting members' }, 400)
    }

    const { data: existingMember } = await admin
      .from('session_members')
      .select('id')
      .eq('session_id', session.id)
      .eq('user_id', body.invitee_user_id)
      .maybeSingle()

    if (existingMember) return json({ error: 'User is already in the session' }, 400)

    const { error: upsertErr } = await admin
      .from('session_invites')
      .upsert(
        {
          session_id: session.id,
          inviter_user_id: user.id,
          invitee_user_id: body.invitee_user_id,
          status: 'pending',
          created_at: new Date().toISOString(),
        },
        { onConflict: 'session_id,invitee_user_id' },
      )

    if (upsertErr) {
      console.error('send-session-invite upsert', upsertErr)
      return json({ error: 'Could not send invite' }, 500)
    }

    return json({ sent: true })
  } catch (e) {
    console.error('send-session-invite', e)
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500)
  }
})
