import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MdPersonSearch, MdSend, MdCheck } from 'react-icons/md'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { fetchSessionCoPartners } from '@/lib/session-co-partners'
import { useAuth } from '@/hooks/use-auth'
import { usePresenceStore } from '@/stores/presence-store'
import { invokeAuthenticatedFunction } from '@/lib/supabase-functions'

interface KnownUser {
  known_user_id: string
  session_count: number
  display_name: string
}

interface ActiveSession {
  id: string
  invite_code: string
}

export function FriendsPage() {
  const { user } = useAuth()
  const { data: friends = [], isLoading } = useQuery({
    queryKey: ['sessionCoPartners', user?.id],
    queryFn: () => fetchSessionCoPartners(supabase, user!.id),
    enabled: Boolean(user),
    staleTime: 0,
  })
  const [search, setSearch] = useState('')
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null)
  const [sentInvites, setSentInvites] = useState<Set<string>>(new Set())
  const [sendingInvite, setSendingInvite] = useState<string | null>(null)
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const onlineUserIds = usePresenceStore((s) => s.onlineUserIds)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const loadActiveSession = async () => {
      const { data } = await supabase
        .from('sessions')
        .select('id, invite_code')
        .eq('host_id', user.id)
        .eq('status', 'waiting')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!cancelled) setActiveSession(data ?? null)
    }

    void loadActiveSession()
    return () => { cancelled = true }
  }, [user])

  const visibleFriends = user ? friends : []
  const showSkeleton = Boolean(user) && isLoading

  const filtered = visibleFriends.filter((f) =>
    f.display_name.toLowerCase().includes(search.toLowerCase())
  )

  const sendInAppInvite = async (friend: KnownUser) => {
    if (!activeSession) return
    setSendingInvite(friend.known_user_id)
    const { error } = await invokeAuthenticatedFunction('send-session-invite', {
      body: { session_id: activeSession.id, invitee_user_id: friend.known_user_id },
    })
    if (!error) {
      setSentInvites((prev) => new Set(prev).add(friend.known_user_id))
    }
    setSendingInvite(null)
  }

  const shareInvite = async (friend: KnownUser) => {
    const origin = window.location.origin
    const text = `Hey ${friend.display_name}! Let's pick dinner together on nosh: ${origin}/join`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Join me on nosh', text })
        return
      }
    } catch {
      /* dismissed share sheet */
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopiedUserId(friend.known_user_id)
      window.setTimeout(() => setCopiedUserId(null), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Friends" subtitle={`${visibleFriends.length} people you've noshed with`} />

      <div className="p-4">
        <div className="relative">
          <MdPersonSearch className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search friends..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex-1 px-4">
        {showSkeleton ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border p-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MdPersonSearch className="h-12 w-12 text-muted-foreground/40" />
            <p className="mt-3 font-medium text-muted-foreground">
              {search ? 'No friends match your search' : 'No friends yet'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              {search
                ? 'Try a different name'
                : 'Friends are added automatically after shared sessions'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((friend) => {
              const isOnline = onlineUserIds.has(friend.known_user_id)
              const canInAppInvite = isOnline && activeSession
              const wasSent = sentInvites.has(friend.known_user_id)
              const isSending = sendingInvite === friend.known_user_id

              return (
                <div
                  key={friend.known_user_id}
                  className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-accent/50"
                >
                  <div className="relative">
                    <UserAvatar name={friend.display_name} />
                    {isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{friend.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {friend.session_count} session{friend.session_count !== 1 ? 's' : ''} together
                      {isOnline && ' · Online'}
                    </p>
                  </div>
                  {canInAppInvite ? (
                    <Button
                      type="button"
                      variant={wasSent ? 'outline' : 'default'}
                      size="sm"
                      className="gap-1.5"
                      disabled={wasSent || isSending}
                      onClick={() => void sendInAppInvite(friend)}
                    >
                      {wasSent ? (
                        <>
                          <MdCheck className="h-4 w-4" />
                          Sent
                        </>
                      ) : (
                        <>
                          <MdSend className="h-4 w-4" />
                          {isSending ? 'Sending...' : 'Invite'}
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => void shareInvite(friend)}
                    >
                      <MdSend className="h-4 w-4" />
                      {copiedUserId === friend.known_user_id ? 'Copied!' : 'Invite'}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
