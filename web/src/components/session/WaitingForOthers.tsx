import { MdCheck, MdHourglassTop, MdSkipNext, MdArrowForward } from 'react-icons/md'
import { UserAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import type { Database } from '@/types/database'

type Session = Database['public']['Tables']['sessions']['Row']
type SessionMember = Database['public']['Tables']['session_members']['Row']

interface WaitingForOthersProps {
  session: Session
  members: SessionMember[]
  onSkipMember: (memberId: string) => void
  onSeeResults?: () => void
}

export function WaitingForOthers({ session, members, onSkipMember, onSeeResults }: WaitingForOthersProps) {
  const { user } = useAuth()
  const isHost = user?.id === session.host_id
  const activeDone = members.filter((m) => !m.is_skipped && m.has_submitted).length
  const active = members.filter((m) => !m.is_skipped).length
  const allDone = activeDone === active

  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-5 pt-10">
      <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-primary/10">
        <MdHourglassTop className="h-8 w-8 text-primary" />
      </div>

      <div className="text-center">
        <h2 className="text-xl font-medium">
          {allDone
            ? isHost ? "Everyone's done!" : 'Waiting for results...'
            : 'Waiting for everyone...'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {allDone
            ? isHost ? 'You can see the results now' : 'The host will reveal results soon'
            : `${activeDone} of ${active} members have swiped`}
        </p>
      </div>

      <div className="w-full space-y-2">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center gap-3 rounded-xl border bg-card p-3"
          >
            <UserAvatar name={member.display_name} size="sm" />
            <p className="flex-1 text-sm font-medium">{member.display_name}</p>
            {member.is_skipped ? (
              <Badge variant="meh">Skipped</Badge>
            ) : member.has_submitted ? (
              <Badge variant="success">
                <MdCheck className="mr-1 h-3 w-3" />
                Done
              </Badge>
            ) : (
              <div className="flex items-center gap-1.5">
                <Badge variant="outline">Swiping...</Badge>
                {isHost && member.user_id !== session.host_id && (
                  <button
                    onClick={() => onSkipMember(member.id)}
                    className="text-muted-foreground hover:text-primary"
                    title={`Skip ${member.display_name}`}
                  >
                    <MdSkipNext className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {isHost && onSeeResults && (
        <div className="mt-auto w-full pb-4">
          <Button className="w-full gap-2" size="lg" onClick={onSeeResults}>
            See Results
            <MdArrowForward className="h-5 w-5" />
          </Button>
          {!allDone && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Members still swiping will be skipped
            </p>
          )}
        </div>
      )}

      {isHost && !onSeeResults && (
        <p className="text-xs text-muted-foreground">
          As host, you can skip members who are taking too long
        </p>
      )}
    </div>
  )
}
