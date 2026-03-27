import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { usePresenceStore } from '@/stores/presence-store'

/**
 * Joins a global Supabase Realtime Presence channel so other users
 * can see who is currently online. Safe to call from multiple
 * components — Supabase deduplicates channel subscriptions by name.
 */
export function useOnlinePresence() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    const displayName =
      (user.user_metadata?.display_name as string) ?? user.email ?? 'Unknown'

    const channel = supabase.channel('online-users', {
      config: { presence: { key: user.id } },
    })

    const syncPresence = () => {
      const state = channel.presenceState()
      const ids = new Set<string>(Object.keys(state))
      usePresenceStore.getState().setOnlineUserIds(ids)
    }

    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, display_name: displayName })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])
}
