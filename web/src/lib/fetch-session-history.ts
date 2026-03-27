import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

export interface SessionHistoryItem {
  id: string
  created_at: string
  invite_code: string
  status: 'waiting' | 'swiping' | 'round_two' | 'completed' | string
  winner: {
    name: string
    address: string | null
    rating: number | null
  } | null
  participants: string[]
}

export async function fetchSessionHistory(
  client: SupabaseClient<Database>,
): Promise<SessionHistoryItem[]> {
  const { data: sessions } = await client
    .from('sessions')
    .select(
      'id, created_at, invite_code, status, winner_restaurant_id, winner:restaurants!sessions_winner_restaurant_id_fkey(name, address, rating), session_members(display_name)',
    )
    .order('created_at', { ascending: false })

  if (!sessions?.length) return []

  return sessions.map((session) => {
    const participants: string[] = []
    for (const m of (session as unknown as { session_members: { display_name: string }[] })
      .session_members ?? []) {
      if (m.display_name && !participants.includes(m.display_name)) {
        participants.push(m.display_name)
      }
    }

    return {
      id: session.id,
      created_at: session.created_at,
      invite_code: session.invite_code,
      status: session.status,
      winner: Array.isArray(session.winner) ? session.winner[0] ?? null : session.winner,
      participants,
    }
  })
}
