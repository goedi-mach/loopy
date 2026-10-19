const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const REFRESH_INTERVAL_MS = 45 * 60 * 1000 // refresh every 45 minutes

export function hasToken(): boolean {
  return !!localStorage.getItem('php_token')
}

export function clearSession(): void {
  localStorage.removeItem('php_token')
  localStorage.removeItem('php_refresh_token')
  localStorage.removeItem('php_email')
}

// Swap the refresh token for a fresh access token.
// Fails quietly, like the old auth.js: an expired session is caught on the next API call.
export async function refreshToken(): Promise<void> {
  const refresh_token = localStorage.getItem('php_refresh_token')
  if (!refresh_token) return

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ refresh_token }),
    })
    if (!res.ok) return
    const data = await res.json()
    localStorage.setItem('php_token', data.access_token)
    localStorage.setItem('php_refresh_token', data.refresh_token)
  } catch (err) {
    console.warn('Token refresh failed:', err)
  }
}

export function getRole(): string | null {
  try {
    const token = localStorage.getItem('php_token')
    if (!token) return null
    return JSON.parse(atob(token.split('.')[1])).app_metadata?.role || null
  } catch {
    return null
  }
}


export function getUserId(): string | null {
  try {
    const token = localStorage.getItem('php_token')
    if (!token) return null
    return JSON.parse(atob(token.split('.')[1])).sub || null
  } catch {
    return null
  }
}