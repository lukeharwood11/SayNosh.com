import type { Location } from 'react-router-dom'

const DEFAULT_AFTER_AUTH = '/app'

/**
 * Returns a path + search safe for same-origin client navigation (open redirect hardening).
 */
export function safeInternalPath(raw: string | null | undefined): string | null {
  if (raw == null || raw === '') return null
  const trimmed = raw.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null
  const q = trimmed.indexOf('?')
  const pathname = q === -1 ? trimmed : trimmed.slice(0, q)
  const search = q === -1 ? '' : trimmed.slice(q)
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return null
  if (pathname.includes('://')) return null
  try {
    const decodedPath = decodeURIComponent(pathname)
    if (decodedPath.startsWith('//')) return null
  } catch {
    return null
  }
  return `${pathname}${search}`
}

export function pathFromRouterLocation(from: Pick<Location, 'pathname' | 'search'>): string {
  return `${from.pathname}${from.search}`
}

function isAuthPath(path: string): boolean {
  return path === '/auth' || path.startsWith('/auth?')
}

/** Prefer router state (from ProtectedRoute), then ?next=, then default. */
export function resolvePostAuthPath(location: Location): string {
  const fromState = location.state as { from?: Pick<Location, 'pathname' | 'search'> } | null
  if (fromState?.from) {
    const p = safeInternalPath(pathFromRouterLocation(fromState.from))
    if (p && !isAuthPath(p)) return p
  }
  const next = new URLSearchParams(location.search).get('next')
  const fromQuery = safeInternalPath(next)
  if (fromQuery && !isAuthPath(fromQuery)) return fromQuery
  return DEFAULT_AFTER_AUTH
}
