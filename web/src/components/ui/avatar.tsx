import * as React from 'react'
import { cn } from '@/lib/utils'

const COLORS = [
  { bg: 'bg-[#FAECE7]', text: 'text-[#993C1D]' },
  { bg: 'bg-[#E6F1FB]', text: 'text-[#185FA5]' },
  { bg: 'bg-[#E1F5EE]', text: 'text-[#0F6E56]' },
  { bg: 'bg-[#FFF3CD]', text: 'text-[#856404]' },
  { bg: 'bg-[#F3E5F5]', text: 'text-[#6A1B9A]' },
]

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getColorIndex(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % COLORS.length
}

interface UserAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string
  size?: 'sm' | 'md' | 'lg'
}

function UserAvatar({ name, size = 'md', className, ...props }: UserAvatarProps) {
  const color = COLORS[getColorIndex(name)]
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-medium',
        color.bg,
        color.text,
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {getInitials(name)}
    </div>
  )
}

export { UserAvatar }
