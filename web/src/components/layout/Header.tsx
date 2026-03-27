import { useNavigate } from 'react-router-dom'
import { MdArrowBack } from 'react-icons/md'

interface HeaderProps {
  title: string
  subtitle?: string
  showBack?: boolean
  action?: React.ReactNode
}

export function Header({ title, subtitle, showBack, action }: HeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-10 bg-primary px-4 pb-3 pt-[calc(var(--safe-area-top)+0.75rem)]">
      <div className="flex items-center gap-3">
        {showBack && (
          <button onClick={() => navigate(-1)} className="text-white/90 hover:text-white">
            <MdArrowBack className="h-6 w-6" />
          </button>
        )}
        <div className="flex-1">
          <h1 className="text-base font-medium text-white">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 text-xs text-white/65">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
    </header>
  )
}
