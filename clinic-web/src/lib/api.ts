import { clearSession } from './auth'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('php_token')
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
  }
}

// Low-level call. `path` is relative to the Supabase URL, e.g. '/rest/v1/clients?...'
// or '/storage/v1/object/pet-photos/abc.jpg'. Returns the raw Response so callers
// can read headers or send files. Handles an expired session in one place.
export async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers as Record<string, string>) },
  })

  if (res.status === 401) {
    clearSession()
    window.location.href = '/login?expired=1'
    throw new Error('Session expired')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || res.statusText)
  }
  return res
}

// Read rows. `path` is everything after /rest/v1/, e.g. 'clients?archived=eq.false'
export async function sbGet<T = any>(path: string): Promise<T> {
  const res = await request(`/rest/v1/${path}`, { headers: { Accept: 'application/json' } })
  return res.json()
}

// Insert a row and get it back
export async function sbPost<T = any>(table: string, data: unknown): Promise<T[]> {
  const res = await request(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(data),
  })
  return res.json()
}

// Update rows and get them back. `path` like 'clients?id=eq.123'
export async function sbPatch<T = any>(path: string, data: unknown): Promise<T[]> {
  const res = await request(`/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(data),
  })
  return res.json()
}

// Delete rows and return them. An empty array means nothing was deleted
// (usually a database permission rule), so callers should check for that.
export async function sbDelete<T = any>(path: string): Promise<T[]> {
  const res = await request(`/rest/v1/${path}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
  })
  return res.json()
}