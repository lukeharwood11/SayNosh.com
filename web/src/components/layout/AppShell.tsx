import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { useOnlinePresence } from '@/hooks/use-online-presence'
import { useInviteListener } from '@/hooks/use-invite-listener'

export function AppShell() {
  useOnlinePresence()
  useInviteListener()

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
