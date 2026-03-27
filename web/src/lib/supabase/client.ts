import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

  return createBrowserClient(
    import.meta.env.VITE_SUPABASE_URL!,
    publishableKey!
  )
}
