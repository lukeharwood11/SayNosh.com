import { createClient } from 'npm:@supabase/supabase-js@2'
import type { SupabaseClient, User } from 'npm:@supabase/supabase-js@2'
import { json } from './http.ts'

export interface AuthContext {
  user: User
  admin: SupabaseClient
}

let _admin: SupabaseClient | null = null

function getAdminClient(): SupabaseClient | null {
  if (_admin) return _admin

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return null

  _admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _admin
}

/**
 * Validates the Bearer token, reuses a cached service-role Supabase client,
 * and returns the authenticated user + admin client. Returns a Response on failure.
 */
export async function requireAuth(
  req: Request,
): Promise<AuthContext | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const admin = getAdminClient()
  if (!admin) return json({ error: 'Server misconfigured' }, 500)

  const { data, error } = await admin.auth.getUser(authHeader.slice(7).trim())
  if (error || !data?.user) return json({ error: 'Unauthorized' }, 401)

  return { user: data.user, admin }
}
