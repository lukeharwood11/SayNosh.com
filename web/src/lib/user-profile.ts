import type { User } from '@supabase/supabase-js'

/**
 * Display name from Supabase Auth `user_metadata` (email signup, Google OAuth, etc.).
 */
export function getProfileDisplayName(user: User | null | undefined): string {
  if (!user) return ''
  const m = user.user_metadata as Record<string, unknown>
  const pick = (key: string) => {
    const v = m[key]
    return typeof v === 'string' ? v.trim() : ''
  }
  return (
    pick('display_name') ||
    pick('full_name') ||
    pick('name') ||
    (typeof user.email === 'string' ? user.email.split('@')[0] : '') ||
    ''
  )
}

/** Email/password accounts can set `display_name`; OAuth-only accounts use provider metadata. */
export function canEditProfileDisplayName(user: User | null | undefined): boolean {
  if (!user?.identities?.length) return false
  return user.identities.some((i) => i.provider === 'email')
}
