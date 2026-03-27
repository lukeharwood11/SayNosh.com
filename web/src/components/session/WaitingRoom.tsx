import { MdContentCopy, MdSkipNext, MdCheck, MdSend } from 'react-icons/md'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { UserAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/use-auth'
import { usePresenceStore } from '@/stores/presence-store'
import { supabase } from '@/lib/supabase'
import { fetchSessionCoPartners } from '@/lib/session-co-partners'
import { invokeAuthenticatedFunction } from '@/lib/supabase-functions'
import type { Database } from '@/types/database'
import { useState, useEffect } from 'react'

type Session = Database['public']['Tables']['sessions']['Row']
type SessionMember = Database['public']['Tables']['session_members']['Row']

interface KnownFriend {
  known_user_id: string
  display_name: string
}

interface WaitingRoomProps {
  session: Session
  members: SessionMember[]
  onSkipMember: (memberId: string) => void
  onStartSwiping: () => void
}

export function WaitingRoom({ session, members, onSkipMember, onStartSwiping }: WaitingRoomProps) {
  const { user } = useAuth()
  const isHost = user?.id === session.host_id
  const [copied, setCopied] = useState(false)
  const shareLink = `${window.location.origin}/join/${session.invite_code}`
  const onlineUserIds = usePresenceStore((s) => s.onlineUserIds)

  const [friends, setFriends] = useState<KnownFriend[]>([])
  const [sentInvites, setSentInvites] = useState<Set<string>>(new Set())
  const [sendingInvite, setSendingInvite] = useState<string | null>(null)

  useEffect(() => {
    if (!isHost || !user) return
    let cancelled = false

    const load = async () => {
      const partners = await fetchSessionCoPartners(supabase, user.id)
      if (cancelled) return
      setFriends(
        partners.map((p) => ({
          known_user_id: p.known_user_id,
          display_name: p.display_name,
        })),
      )
    }

    void load()
    return () => { cancelled = true }
  }, [isHost, user])

  const memberUserIds = new Set(members.map((m) => m.user_id).filter(Boolean))

  const invitableFriends = friends.filter(
    (f) => !memberUserIds.has(f.known_user_id),
  )

  const sendInvite = async (friendId: string) => {
    setSendingInvite(friendId)
    const { error } = await invokeAuthenticatedFunction('send-session-invite', {
      body: { session_id: session.id, invitee_user_id: friendId },
    })
    if (!error) {
      setSentInvites((prev) => new Set(prev).add(friendId))
    }
    setSendingInvite(null)
  }

  const copyCode = async () => {
    const copyValue = isHost ? shareLink : session.invite_code
    await navigator.clipboard.writeText(copyValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-1 flex-col gap-5 p-5">
      <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col items-center gap-3 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Share this code
          </p>
          <div className="flex items-center gap-3">
            <span
              className="text-3xl font-bold tracking-[0.2em] text-primary"
              data-testid="session-invite-code"
            >
              {session.invite_code}
            </span>
            <button
              onClick={copyCode}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors hover:bg-primary/20"
            >
              {copied ? <MdCheck className="h-5 w-5" /> : <MdContentCopy className="h-5 w-5" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {isHost
              ? 'Share this code — copy button grabs a full join link'
              : 'Anyone with this code can join the session'}
          </p>
        </CardContent>
      </Card>

      {isHost && invitableFriends.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Invite Friends
            </p>
          </div>
          <div className="space-y-2">
            {invitableFriends.map((friend) => {
              const isOnline = onlineUserIds.has(friend.known_user_id)
              const wasSent = sentInvites.has(friend.known_user_id)
              const isSending = sendingInvite === friend.known_user_id

              return (
                <div
                  key={friend.known_user_id}
                  className={`flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors ${
                    isOnline ? '' : 'opacity-60'
                  }`}
                >
                  <div className="relative">
                    <UserAvatar name={friend.display_name} size="sm" />
                    {isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{friend.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {isOnline ? 'Online' : 'Offline'}
                    </p>
                  </div>
                  {isOnline ? (
                    <Button
                      type="button"
                      variant={wasSent ? 'outline' : 'secondary'}
                      size="sm"
                      className="gap-1.5"
                      disabled={wasSent || isSending}
                      data-testid="invite-friend-button"
                      onClick={() => void sendInvite(friend.known_user_id)}
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
                    <span className="text-xs text-muted-foreground">Offline</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Members · {members.length}
          </p>
        </div>

        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-xl border bg-card p-3"
            >
              <UserAvatar name={member.display_name} size="sm" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {member.display_name}
                  {member.user_id === session.host_id && (
                    <span className="ml-1.5 text-xs text-muted-foreground">Host</span>
                  )}
                </p>
              </div>
              {member.is_skipped ? (
                <Badge variant="meh">Skipped</Badge>
              ) : member.has_submitted ? (
                <Badge variant="success">Done</Badge>
              ) : (
                <>
                  <Badge variant="outline">Waiting</Badge>
                  {isHost && member.user_id !== session.host_id && (
                    <button
                      onClick={() => onSkipMember(member.id)}
                      className="ml-1 text-muted-foreground hover:text-primary"
                      title="Skip this member"
                    >
                      <MdSkipNext className="h-5 w-5" />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {isHost && (
        <div className="mt-auto pb-4">
          <Button
            className="w-full"
            size="lg"
            onClick={(e) => {
              ;(e.currentTarget as HTMLButtonElement).blur()
              void onStartSwiping()
            }}
          >
            Start swiping
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Everyone who joined will start swiping at the same time
          </p>
        </div>
      )}

      {!isHost && (
        <div className="mt-auto pb-4 text-center">
          <p className="text-sm text-muted-foreground">
            Waiting for the host to start swiping...
          </p>
        </div>
      )}
    </div>
  )
}
