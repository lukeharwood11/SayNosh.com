import { useEffect, useMemo, useState } from 'react'

const DEFAULT_MESSAGES = [
  'Brewing...',
  'Cooking...',
  'Searching nearby spots...',
  'Plating your options...',
  'Seasoning the results...',
]

interface LoadingOverlayProps {
  visible: boolean
  title?: string
  messages?: string[]
  intervalMs?: number
}

function RotatingMessage({
  title,
  messagePool,
  intervalMs,
}: {
  title: string
  messagePool: string[]
  intervalMs: number
}) {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMessageIndex((prev) => {
        if (messagePool.length <= 1) return prev
        let next = prev
        while (next === prev) {
          next = Math.floor(Math.random() * messagePool.length)
        }
        return next
      })
    }, intervalMs)

    return () => window.clearInterval(timer)
  }, [intervalMs, messagePool])

  return (
    <div className="rounded-xl border border-border bg-white/95 px-4 py-3 shadow-sm">
      <p className="text-base font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-foreground/80">{messagePool[messageIndex]}</p>
    </div>
  )
}

export function LoadingOverlay({
  visible,
  title = 'One sec — we\'re on it',
  messages = DEFAULT_MESSAGES,
  intervalMs = 2200,
}: LoadingOverlayProps) {
  const messagePool = useMemo(() => (messages.length > 0 ? messages : DEFAULT_MESSAGES), [messages])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent">
      <div className="flex flex-col items-center gap-4 px-6 text-center">
        <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <svg
            viewBox="-2 -8 28 34"
            aria-label="Loading utensils animation"
            role="img"
            className="h-16 w-16 overflow-visible"
          >
            <path
              className="loading-fork-path"
              fill="var(--color-primary)"
              d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7z"
            />
            <path
              className="loading-knife-path"
              fill="var(--color-primary)"
              d="M16 6v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"
            />
          </svg>
        </div>
        <RotatingMessage
          title={title}
          messagePool={messagePool}
          intervalMs={intervalMs}
        />
      </div>
    </div>
  )
}
