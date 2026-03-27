import { useEffect, useRef } from 'react'
import { usePostHog } from '@posthog/react'
import { useAuth } from '@/hooks/use-auth'

const posthogEnabled = Boolean(import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN)

function identifyKeyForUser(user: NonNullable<ReturnType<typeof useAuth>['user']>) {
  const displayName =
    typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : ''
  return `${user.id}:${user.email ?? ''}:${displayName}`
}

export function usePostHogIdentify() {
  const posthog = usePostHog()
  const { user, loading } = useAuth()
  const lastIdentifyKey = useRef<string | null>(null)

  useEffect(() => {
    if (!posthogEnabled) return
    if (loading) return

    if (user) {
      const key = identifyKeyForUser(user)
      if (lastIdentifyKey.current === key) return
      lastIdentifyKey.current = key

      const displayName =
        typeof user.user_metadata?.display_name === 'string'
          ? user.user_metadata.display_name
          : undefined

      posthog?.identify(user.id, {
        email: user.email ?? undefined,
        ...(displayName ? { name: displayName } : {}),
      })
      return
    }

    if (lastIdentifyKey.current !== null) {
      lastIdentifyKey.current = null
      posthog?.reset()
    }
  }, [posthog, user, loading])
}
