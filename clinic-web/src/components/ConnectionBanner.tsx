import { useEffect, useRef, useState } from 'react'
import './ConnectionBanner.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const RECHECK_MS = 10_000 // while offline, check again every 10 seconds
const BACK_ONLINE_MS = 4_000 // how long the green "back online" bar stays up

export default function ConnectionBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)
  const [justBack, setJustBack] = useState(false)
  const wasOffline = useRef(offline)

  // Listen for the browser losing Wi-Fi, and for LoopVet's own requests failing or succeeding
  useEffect(() => {
    const down = () => setOffline(true)
    const up = () => setOffline(false)
    window.addEventListener('offline', down)
    window.addEventListener('loopy:offline', down)
    window.addEventListener('loopy:online', up)
    return () => {
      window.removeEventListener('offline', down)
      window.removeEventListener('loopy:offline', down)
      window.removeEventListener('loopy:online', up)
    }
  }, [])

  // While offline, keep checking whether Supabase can be reached again.
  // (The browser's own "online" event only means Wi-Fi is back, not that the internet works.)
  useEffect(() => {
    if (!offline) return
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
          headers: { apikey: SUPABASE_ANON_KEY },
          cache: 'no-store',
        })
        if (!cancelled && res.ok) setOffline(false)
      } catch {
        // still offline; try again on the next tick
      }
    }
    const timer = setInterval(check, RECHECK_MS)
    window.addEventListener('online', check)
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('online', check)
    }
  }, [offline])

  // Show a short green "back online" bar when the connection returns
  useEffect(() => {
    const cameBack = wasOffline.current && !offline
    wasOffline.current = offline
    if (!cameBack) return
    setJustBack(true)
    const timer = setTimeout(() => setJustBack(false), BACK_ONLINE_MS)
    return () => clearTimeout(timer)
  }, [offline])

  if (offline) {
    return (
      <div className="conn-banner offline" role="alert">
        <strong>⚠️ No connection — changes are not saving.</strong> Wait for the signal before logging vaccines.
        <span className="conn-banner-es">Sin conexión — los cambios no se están guardando. Espere la señal antes de registrar vacunas.</span>
      </div>
    )
  }
  if (justBack) {
    return (
      <div className="conn-banner online" role="status">
        ✅ Back online · Conexión restablecida
      </div>
    )
  }
  return null
}