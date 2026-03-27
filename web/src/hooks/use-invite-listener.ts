import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { useInviteStore } from '@/stores/invite-store'

/**
 * Listens for new session_invites rows targeting the current user
 * via Supabase Realtime postgres_changes, and pushes them into
 * the invite store so InviteToast can display them.
 */
export function useInviteListener() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('invite-listener')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'session_invites',
          filter: `invitee_user_id=eq.${user.id}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string
            session_id: string
            inviter_user_id: string
            status: string
          }

          if (row.status !== 'pending') return

          // Look up inviter display name from session_members
          const { data: session } = await supabase
            .from('sessions')
            .select('invite_code')
            .eq('id', row.session_id)
            .single()

          const { data: inviterMember } = await supabase
            .from('session_members')
            .select('display_name')
            .eq('session_id', row.session_id)
            .eq('user_id', row.inviter_user_id)
            .maybeSingle()

          useInviteStore.getState().addInvite({
            id: row.id,
            session_id: row.session_id,
            inviter_name: inviterMember?.display_name ?? 'Someone',
            invite_code: session?.invite_code ?? '',
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])
}
