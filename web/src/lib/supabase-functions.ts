import { supabase } from '@/lib/supabase'
import { FunctionsHttpError, type Session } from '@supabase/supabase-js'

/** Parse JSON body from a non-2xx Edge Function response (e.g. `{ error: string }`). */
export async function readFunctionsHttpErrorBody(
  error: unknown,
): Promise<Record<string, unknown> | null> {
  if (!(error instanceof FunctionsHttpError)) return null
  const res = error.context
  if (!(res instanceof Response)) return null
  const ct = res.headers.get('Content-Type') ?? ''
  if (!ct.includes('application/json')) return null
  try {
    return (await res.clone().json()) as Record<string, unknown>
  } catch {
    return null
  }
}

type InvokeOptions = {
  body?:
    | string
    | Record<string, unknown>
    | FormData
    | File
    | Blob
    | ArrayBuffer
    | ReadableStream<Uint8Array>
  headers?: Record<string, string>
}

async function getFreshSession(): Promise<{
  session: Session | null
  error: Error | null
}> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    return { session: null, error }
  }

  const expiresAt = session?.expires_at
  const isExpiredOrExpiring =
    !session?.access_token ||
    (expiresAt != null && expiresAt <= Math.floor(Date.now() / 1000) + 60)

  if (!isExpiredOrExpiring) {
    return { session, error: null }
  }

  const {
    data: refreshData,
    error: refreshError,
  } = await supabase.auth.refreshSession()

  return {
    session: refreshData.session ?? null,
    error: refreshError,
  }
}

async function refreshCurrentSession(): Promise<{
  session: Session | null
  error: Error | null
}> {
  const {
    data,
    error,
  } = await supabase.auth.refreshSession()

  return {
    session: data.session ?? null,
    error,
  }
}

async function invokeWithSession<TData = unknown>(
  name: string,
  options: InvokeOptions,
  session: Session,
) {
  const functions = supabase.functions
  functions.setAuth(session.access_token)

  return functions.invoke<TData>(name, options)
}

/**
 * Edge Functions in this app require a signed-in user's JWT.
 * The publishable key identifies the app, not the user.
 */
export async function invokeAuthenticatedFunction<TData = unknown>(
  name: string,
  options: InvokeOptions = {},
) {
  const { session, error: sessionError } = await getFreshSession()

  if (!session?.access_token) {
    return {
      data: null,
      error:
        sessionError ??
        new Error('Your session expired. Please sign in again before calling this action.'),
    }
  }

  const result = await invokeWithSession<TData>(name, options, session)

  const errorContext =
    result.error &&
    typeof result.error === 'object' &&
    'context' in result.error
      ? (result.error as { context: unknown }).context
      : undefined
  const isGateway401 =
    errorContext instanceof Response && errorContext.status === 401

  if (!isGateway401) {
    return result
  }

  const { session: refreshedSession, error: refreshError } = await refreshCurrentSession()
  if (!refreshedSession?.access_token) {
    return {
      ...result,
      error: refreshError ?? result.error,
    }
  }

  return invokeWithSession<TData>(name, options, refreshedSession)
}
