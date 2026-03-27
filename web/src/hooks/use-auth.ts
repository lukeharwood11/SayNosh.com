import { useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { safeInternalPath } from '@/lib/auth-redirect'
import { useAuthStore } from '@/stores/auth-store'

export function useAuth() {
  const { user, loading, setUser, setLoading } = useAuthStore()

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null)
      })
      .catch(() => {
        setUser(null)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [setUser])

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    return { error }
  }, [setLoading])

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    setLoading(false)
    return { error, session: data.session }
  }, [setLoading])

  /** Redirects back to `/auth?next=…` — add that pattern to Supabase Auth → URL configuration redirect allow list. */
  const signInWithGoogle = useCallback(async (returnPath = '/app') => {
    const path = safeInternalPath(returnPath) ?? '/app'
    const next = new URL('/auth', window.location.origin)
    next.searchParams.set('next', path)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: next.toString() },
    })
    return { error }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const updateDisplayName = useCallback(async (displayName: string) => {
    const trimmed = displayName.trim()
    if (!trimmed) return { error: new Error('Name is required') }
    const { data, error } = await supabase.auth.updateUser({
      data: { display_name: trimmed },
    })
    if (data.user) setUser(data.user)
    return { error }
  }, [setUser])

  return { user, loading, signIn, signUp, signInWithGoogle, signOut, updateDisplayName }
}
