import { useEffect, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { hasToken, refreshToken, REFRESH_INTERVAL_MS } from '../lib/auth'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const signedIn = hasToken()

  // Same schedule as the old auth.js: once after 5 seconds, then every 45 minutes.
  useEffect(() => {
    if (!signedIn) return
    const first = setTimeout(refreshToken, 5000)
    const timer = setInterval(refreshToken, REFRESH_INTERVAL_MS)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [signedIn])

  if (!signedIn) return <Navigate to="/login" replace />
  return <>{children}</>
}