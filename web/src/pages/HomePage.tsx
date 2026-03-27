import { Link, useNavigate } from 'react-router-dom'
import { MdRestaurant, MdGroups, MdSwipe, MdShield } from 'react-icons/md'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'

export function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div className="flex min-h-svh flex-col bg-background px-5 pb-8 pt-[calc(var(--safe-area-top)+1.5rem)] md:px-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="mb-8 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <MdRestaurant className="h-8 w-8 text-white" />
          </div>
        </div>

        <h1 className="text-center text-4xl font-semibold tracking-tight text-foreground">nosh</h1>
        <p className="mt-2 text-center text-base text-muted-foreground">
          Where your group finally agrees on dinner.
        </p>

        <div className="mt-8 space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
              <MdGroups className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Create a dinner session</p>
              <p className="text-sm text-muted-foreground">Pick an area and invite your friends.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-nosh-yes/10 p-2">
              <MdSwipe className="h-5 w-5 text-nosh-yes" />
            </div>
            <div>
              <p className="font-medium">Swipe together</p>
              <p className="text-sm text-muted-foreground">Like what you want, skip what you don't.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-accent p-2">
              <MdShield className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <p className="font-medium">Get one clear winner</p>
              <p className="text-sm text-muted-foreground">nosh finds the best overlap for your group.</p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-3">
          <Button size="lg" onClick={() => navigate(user ? '/app' : '/auth')}>
            {user ? 'Open App' : 'Get Started'}
          </Button>
          {!user && (
            <Button size="lg" variant="outline" onClick={() => navigate('/auth')}>
              Sign in
            </Button>
          )}
        </div>

        <div className="mt-auto pt-10 text-center text-xs text-muted-foreground">
          <p>Stop arguing. Start swiping.</p>
          <div className="mt-3 flex items-center justify-center gap-4">
            <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
