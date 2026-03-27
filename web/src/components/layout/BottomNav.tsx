import { NavLink } from 'react-router-dom'
import { MdHome, MdHistory, MdPeople, MdPerson } from 'react-icons/md'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/app', icon: MdHome, label: 'Home' },
  { to: '/app/history', icon: MdHistory, label: 'History' },
  { to: '/app/friends', icon: MdPeople, label: 'Friends' },
  { to: '/app/profile', icon: MdPerson, label: 'Profile' },
]

export function BottomNav() {
  return (
    <nav className="w-full shrink-0 border-t bg-background/80 backdrop-blur-lg pb-[max(var(--safe-area-bottom),0.25rem)]">
      <div className="flex items-center justify-around pt-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 rounded-lg px-4 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            <Icon className="h-6 w-6" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
