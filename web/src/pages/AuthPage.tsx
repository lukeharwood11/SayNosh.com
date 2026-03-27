import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MdRestaurant, MdEmail, MdLock, MdPerson } from 'react-icons/md'
import { FcGoogle } from 'react-icons/fc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { usePostHog } from '@posthog/react'
import { useAuth } from '@/hooks/use-auth'
import { resolvePostAuthPath } from '@/lib/auth-redirect'

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const posthog = usePostHog()
  const { signIn, signUp, signInWithGoogle, user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (loading) return
    if (!user) return
    navigate(resolvePostAuthPath(location), { replace: true })
  }, [user, loading, navigate, location])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setSubmitting(true)

    if (mode === 'login') {
      const { error: err } = await signIn(email, password)
      if (err) setError(err.message)
      else {
        posthog?.capture('signed_in', { method: 'email' })
      }
    } else {
      if (!displayName.trim()) {
        setError('Display name is required')
        setSubmitting(false)
        return
      }
      const { error: err, session } = await signUp(email, password, displayName.trim())
      if (err) {
        setError(err.message)
      } else if (session) {
        posthog?.capture('signed_up', { method: 'email' })
      } else {
        posthog?.capture('signed_up', { method: 'email', pending_confirmation: true })
        setInfo('Check your email to confirm your account. Then sign in here.')
      }
    }

    setSubmitting(false)
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 pb-[max(2rem,var(--safe-area-bottom))] pt-[calc(var(--safe-area-top)+1.5rem)]">
      <div className="mb-8 flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
          <MdRestaurant className="h-8 w-8 text-white" />
        </div>
        <h1 className="mt-3 text-3xl font-medium tracking-tight text-primary">nosh</h1>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </CardTitle>
          <CardDescription>
            {mode === 'login'
              ? 'Sign in to start swiping'
              : 'Join nosh and never argue about dinner again'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            size="lg"
            onClick={async () => {
              setError('')
              setInfo('')
              posthog?.capture('oauth_sign_in_started', { provider: 'google' })
              const { error: err } = await signInWithGoogle(resolvePostAuthPath(location))
              if (err) setError(err.message)
            }}
          >
            <FcGoogle className="h-5 w-5" />
            Continue with Google
          </Button>

          <div className="relative my-6">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
              or
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="relative">
                <MdPerson className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}
            <div className="relative">
              <MdEmail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
            <div className="relative">
              <MdLock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                required
                minLength={6}
              />
            </div>

            {info && (
              <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-foreground">
                {info}
              </p>
            )}

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Sign in'
                  : 'Create account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              className="text-sm text-muted-foreground hover:text-primary"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login')
                setError('')
                setInfo('')
              }}
            >
              {mode === 'login'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
