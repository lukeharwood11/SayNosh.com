import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MdGroupAdd, MdArrowForward, MdPerson } from 'react-icons/md'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { useSession } from '@/hooks/use-session'
import { useAuth } from '@/hooks/use-auth'
import { getProfileDisplayName } from '@/lib/user-profile'

export function JoinSessionPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { joinSession } = useSession()
  const { user } = useAuth()

  const routeInviteCode = code?.toUpperCase() ?? ''
  const [inviteInput, setInviteInput] = useState(routeInviteCode)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setInviteInput(routeInviteCode)
  }, [routeInviteCode])

  const profileName = getProfileDisplayName(user)

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    const inviteCode = inviteInput.trim()
    if (!inviteCode) {
      setError('Please enter an invite code')
      return
    }
    if (!profileName) {
      setError('Add your name in Profile before joining.')
      return
    }

    setJoining(true)
    setError('')

    const { data, error: err } = await joinSession(inviteCode.toUpperCase())

    if (err) {
      const serverMsg = data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : ''
      setError(serverMsg || err.message || 'Failed to join session')
      setJoining(false)
      return
    }

    const sessionId = data && typeof data === 'object' && 'session_id' in data
      ? String((data as { session_id: unknown }).session_id)
      : ''
    if (!sessionId) {
      setError('Invalid response from server')
      setJoining(false)
      return
    }

    navigate(`/session/${sessionId}`)
  }

  return (
    <div className="flex flex-1 flex-col">
      <LoadingOverlay
        visible={joining}
        title="Joining session"
        messages={[
          'Brewing...',
          'Cooking...',
          'Finding your group...',
          'Pulling up the table...',
        ]}
      />

      <Header title="Join Session" subtitle="Enter your invite code" showBack />

      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-nosh-yes/10">
          <MdGroupAdd className="h-8 w-8 text-nosh-yes" />
        </div>

        <Card className="w-full">
          <CardContent className="p-5">
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Invite code
                </label>
                <Input
                  placeholder="e.g. NX42"
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
                  className="text-center text-lg font-medium tracking-widest"
                  maxLength={8}
                  autoFocus
                />
              </div>

              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MdPerson className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-medium uppercase tracking-wider">
                    Joining as
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {profileName || '—'}
                </p>
                {!profileName && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <Link to="/app/profile" className="text-primary underline underline-offset-2">
                      Set your name in Profile
                    </Link>
                    {' '}to continue.
                  </p>
                )}
              </div>

              {error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full gap-2"
                size="lg"
                disabled={joining || !profileName}
              >
                {joining ? 'Joining...' : 'Join session'}
                <MdArrowForward className="h-5 w-5" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Ask the host for the invite code — it's on their waiting screen
        </p>
      </div>
    </div>
  )
}
