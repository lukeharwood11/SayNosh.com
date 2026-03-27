import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { usePostHog } from '@posthog/react'

export function PostHogPageView() {
  const location = useLocation()
  const posthog = usePostHog()

  useEffect(() => {
    if (!posthog) return
    posthog.capture('$pageview', {
      $current_url: window.location.href,
      $pathname: location.pathname,
      $search: location.search || undefined,
    })
  }, [location.pathname, location.search, posthog])

  return null
}
