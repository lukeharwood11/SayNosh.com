import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

/** People you've shared at least one session with (authenticated co-members only). */
export interface SessionCoPartner {
  known_user_id: string
  display_name: string
  session_count: number
}

/**
 * Derives co-partners from session_members only (no known_users table).
 * RLS: you only see members of sessions you belong to.
 */
export async function fetchSessionCoPartners(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<SessionCoPartner[]> {
  const { data: myMemberships, error: myErr } = await client
    .from('session_members')
    .select('session_id')
    .eq('user_id', userId)

  if (myErr || !myMemberships?.length) return []

  const sessionIds = [...new Set(myMemberships.map((m) => m.session_id))]
  if (sessionIds.length === 0) return []

  const { data: others, error: othersErr } = await client
    .from('session_members')
    .select('session_id, user_id, display_name')
    .in('session_id', sessionIds)
    .not('user_id', 'is', null)
    .neq('user_id', userId)

  if (othersErr || !others?.length) return []

  const { data: sessionsMeta, error: sessionsErr } = await client
    .from('sessions')
    .select('id, created_at')
    .in('id', sessionIds)

  if (sessionsErr) return []

  const createdAtBySession = new Map<string, number>()
  for (const s of sessionsMeta ?? []) {
    createdAtBySession.set(s.id, new Date(s.created_at).getTime())
  }

  const byUser = new Map<
    string,
    { sessionIds: Set<string>; bestTime: number; displayName: string }
  >()

  for (const row of others) {
    const uid = row.user_id
    if (!uid) continue
    const t = createdAtBySession.get(row.session_id) ?? 0
    let rec = byUser.get(uid)
    if (!rec) {
      rec = { sessionIds: new Set(), bestTime: -1, displayName: 'Unknown' }
      byUser.set(uid, rec)
    }
    rec.sessionIds.add(row.session_id)
    if (t >= rec.bestTime && row.display_name) {
      rec.bestTime = t
      rec.displayName = row.display_name
    }
  }

  return [...byUser.entries()]
    .map(([known_user_id, rec]) => ({
      known_user_id,
      display_name: rec.displayName,
      session_count: rec.sessionIds.size,
    }))
    .sort((a, b) => b.session_count - a.session_count)
}
