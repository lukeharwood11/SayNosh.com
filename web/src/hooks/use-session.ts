import { useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { invokeAuthenticatedFunction } from '@/lib/supabase-functions'
import { useSessionStore, type Vote } from '@/stores/session-store'

type SessionResponse = { session_id: string }

export function useSession(sessionId?: string) {
  const store = useSessionStore()

  const fetchSession = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return null
    if (data) useSessionStore.getState().setSession(data)
    return data
  }, [])

  const fetchMembers = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('session_members')
      .select('*')
      .eq('session_id', id)
    if (error) return null
    if (data) useSessionStore.getState().setMembers(data)
    return data
  }, [])

  const fetchRestaurants = useCallback(async (id: string, round = 1) => {
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('session_id', id)
      .eq('round', round)
    if (error) return null
    if (data) useSessionStore.getState().setRestaurants(data)
    return data
  }, [])

  useEffect(() => {
    if (!sessionId) return

    useSessionStore.getState().reset()

    void fetchSession(sessionId)
    void fetchMembers(sessionId)

    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_members', filter: `session_id=eq.${sessionId}` },
        () => { fetchMembers(sessionId) }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        () => { fetchSession(sessionId) }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId, fetchSession, fetchMembers])

  const createSession = useCallback(async (filters: {
    city: string
    state: string
    lat?: number
    lng?: number
    radius: number
    cuisines?: string[]
    custom_options?: string[]
    meal_type?: string
    price_levels?: number[]
    open_now?: boolean
  }) => {
    const { data, error } = await invokeAuthenticatedFunction<SessionResponse>('create-session', {
      body: filters,
    })
    return { data, error }
  }, [])

  const joinSession = useCallback(async (inviteCode: string) => {
    const { data, error } = await invokeAuthenticatedFunction<SessionResponse>('join-session', {
      body: { invite_code: inviteCode },
    })
    return { data, error }
  }, [])

  const submitSwipes = useCallback(async (
    sId: string,
    memberId: string,
    votes: Record<string, Vote>,
    round = 1
  ) => {
    const swipeRows = Object.entries(votes).map(([restaurantId, vote]) => ({
      session_id: sId,
      restaurant_id: restaurantId,
      member_id: memberId,
      vote,
      round,
    }))

    const { error: swipeError } = await supabase.from('swipes').insert(swipeRows)
    if (swipeError) return { data: null, error: swipeError }

    const { error: updateError } = await supabase
      .from('session_members')
      .update({ has_submitted: true })
      .eq('id', memberId)
    if (updateError) return { data: null, error: updateError }

    const { data: pending } = await supabase
      .from('session_members')
      .select('id')
      .eq('session_id', sId)
      .eq('is_skipped', false)
      .eq('has_submitted', false)

    return { data: { all_submitted: !pending || pending.length === 0 }, error: null }
  }, [])

  const skipMember = useCallback(async (sId: string, memberId: string) => {
    const { error: updateError } = await supabase
      .from('session_members')
      .update({ is_skipped: true })
      .eq('id', memberId)
      .eq('session_id', sId)
    if (updateError) return { data: null, error: updateError }

    const { data: pending } = await supabase
      .from('session_members')
      .select('id')
      .eq('session_id', sId)
      .eq('is_skipped', false)
      .eq('has_submitted', false)

    return { data: { skipped: true, all_submitted: !pending || pending.length === 0 }, error: null }
  }, [])

  const startRoundTwo = useCallback(async (sId: string, restaurantIds: string[]) => {
    const { data, error } = await invokeAuthenticatedFunction('start-round-two', {
      body: { session_id: sId, restaurant_ids: restaurantIds },
    })
    return { data, error }
  }, [])

  return {
    ...store,
    fetchSession,
    fetchMembers,
    fetchRestaurants,
    createSession,
    joinSession,
    submitSwipes,
    skipMember,
    startRoundTwo,
  }
}
