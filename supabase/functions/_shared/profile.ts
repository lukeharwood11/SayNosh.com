import type { User } from 'npm:@supabase/supabase-js@2'

export function displayNameFromUser(user: User): string {
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
