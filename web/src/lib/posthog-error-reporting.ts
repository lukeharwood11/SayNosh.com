import posthog from 'posthog-js'

const posthogEnabled = Boolean(import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN)

export function captureAppException(
  error: unknown,
  properties?: Record<string, unknown>,
): void {
  if (!posthogEnabled) return
  if (!posthog.__loaded) return
  try {
    posthog.captureException(error, properties)
  } catch {
    // Never let analytics break the app
  }
}

export function safeSerializeKey(key: unknown): string {
  try {
    return JSON.stringify(key)
  } catch {
    return String(key)
  }
}
