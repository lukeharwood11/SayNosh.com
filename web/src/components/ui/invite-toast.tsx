import { useEffect, useRef, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdRestaurant, MdClose } from 'react-icons/md'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useInviteStore, type PendingInvite } from '@/stores/invite-store'
import {
  invokeAuthenticatedFunction,
  readFunctionsHttpErrorBody,
} from '@/lib/supabase-functions'

const AUTO_DISMISS_MS = 30_000

function InviteCard({ invite }: { invite: PendingInvite }) {
  const navigate = useNavigate()
  const removeInvite = useInviteStore((s) => s.removeInvite)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const dismiss = useCallback(() => {
    removeInvite(invite.id)
    void supabase
      .from('session_invites')
      .update({ status: 'declined' })
      .eq('id', invite.id)
  }, [invite.id, removeInvite])

  const accept = useCallback(async () => {
    if (!invite.invite_code) return
    setJoining(true)
    setJoinError('')

    const { data, error } = await invokeAuthenticatedFunction<{ session_id: string }>(
      'join-session',
      { body: { invite_code: invite.invite_code } },
    )

    if (error || !data?.session_id) {
      const body = await readFunctionsHttpErrorBody(error)
      const serverMsg =
        body && typeof body.error === 'string' ? body.error
        : error instanceof Error ? error.message
        : ''
      setJoinError(serverMsg || 'Could not join this session.')
      setJoining(false)
      return
    }

    void supabase
      .from('session_invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id)

    removeInvite(invite.id)
    navigate(`/session/${data.session_id}`)
  }, [invite, removeInvite, navigate])

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(timerRef.current)
  }, [dismiss])

  return (
    <div className="animate-in slide-in-from-top-2 fade-in relative flex items-center gap-3 rounded-xl border-2 border-primary/30 bg-card p-4 shadow-lg">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <MdRestaurant className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">
          {invite.inviter_name} invited you!
        </p>
        <p className="text-xs text-muted-foreground">Tap accept to join the session</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        {joinError ? (
          <p className="max-w-[14rem] text-right text-xs text-destructive">{joinError}</p>
        ) : null}
        <div className="flex items-center gap-2">
        <Button size="sm" onClick={accept} disabled={joining}>
          {joining ? 'Joining...' : 'Accept'}
        </Button>
        <button
          onClick={dismiss}
          className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <MdClose className="h-4 w-4" />
        </button>
        </div>
      </div>
    </div>
  )
}

export function InviteToast() {
  const invites = useInviteStore((s) => s.invites)

  if (invites.length === 0) return null

  return (
    <div className="pointer-events-auto fixed left-1/2 top-[calc(var(--safe-area-top,0px)+0.75rem)] z-50 w-full max-w-md -translate-x-1/2 space-y-2 px-4">
      {invites.map((invite) => (
        <InviteCard key={invite.id} invite={invite} />
      ))}
    </div>
  )
}
