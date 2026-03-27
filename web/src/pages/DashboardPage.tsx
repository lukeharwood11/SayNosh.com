import { useNavigate } from 'react-router-dom'
import { MdAdd, MdQrCode2, MdRestaurant } from 'react-icons/md'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'

export function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const displayName = user?.user_metadata?.display_name ?? 'there'

  return (
    <div className="flex flex-1 flex-col">
      <div className="bg-primary px-6 pb-10 pt-[calc(var(--safe-area-top)+1.5rem)]">
        <div className="flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
            <MdRestaurant className="h-8 w-8 text-white" />
          </div>
        </div>
        <h1 className="mt-4 text-center text-3xl font-medium tracking-tight text-white">
          nosh
        </h1>
        <p className="mt-1 text-center text-sm text-white/70">
          where your group finally agrees on dinner
        </p>
      </div>

      <div className="-mt-5 flex flex-1 flex-col gap-4 rounded-t-3xl bg-background px-5 pt-8">
        <p className="text-sm text-muted-foreground">
          Hey {displayName}! Ready to figure out where to eat?
        </p>

        <Card
          className="cursor-pointer border-2 border-transparent transition-all hover:border-primary/20 hover:shadow-md active:scale-[0.98]"
          onClick={() => navigate('/create')}
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <MdAdd className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">Start a session</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Pick a spot, invite your friends, and swipe together
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer border-2 border-transparent transition-all hover:border-primary/20 hover:shadow-md active:scale-[0.98]"
          onClick={() => navigate('/join')}
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-nosh-yes/10">
              <MdQrCode2 className="h-6 w-6 text-nosh-yes" />
            </div>
            <div>
              <p className="font-medium">Join a session</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Got an invite code? Jump right in
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-auto pb-4 pt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Stop arguing. Start swiping.
          </p>
        </div>
      </div>
    </div>
  )
}
