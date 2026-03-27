import { type ReactNode } from 'react'
import { PostHogProvider, PostHogErrorBoundary } from '@posthog/react'

const posthogToken = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN

const posthogOptions = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  defaults: '2026-01-30' as const,
  /** Unhandled JS errors + unhandled promise rejections (also enable in PostHog project settings). */
  capture_exceptions: true as const,
}

function PostHogErrorFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6 text-center text-sm text-muted-foreground">
      <p>Something went wrong. Please refresh the page or try again later.</p>
    </div>
  )
}

export function PostHogRoot({ children }: { children: ReactNode }) {
  if (!posthogToken) {
    return <>{children}</>
  }

  return (
    <PostHogProvider apiKey={posthogToken} options={posthogOptions}>
      <PostHogErrorBoundary fallback={<PostHogErrorFallback />}>{children}</PostHogErrorBoundary>
    </PostHogProvider>
  )
}
