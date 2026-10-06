import { useEffect, useState } from 'react'
import PasswordField from './components/PasswordField'
import './Login.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Read the user's role out of the token (used only to pick which page to open)
function getRoleFromToken(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.app_metadata?.role || 'volunteer'
  } catch {
    return 'volunteer'
  }
}

function pageForRole(role: string) {
  return role === 'staff' || role === 'admin' ? 'staff-home.html' : 'volunteer-home.html'
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [destination, setDestination] = useState('')
  const [error, setError] = useState(() =>
    new URLSearchParams(window.location.search).get('expired') === '1'
      ? 'Your session has expired. Please sign in again.'
      : ''
  )

  // On a real site, jump to the page. On localhost, just show where we would go.
  function goTo(page: string) {
    if (import.meta.env.DEV) {
      setDestination(page)
    } else {
      window.location.href = page
    }
  }

  // Runs once on load: skip the form if already signed in
  useEffect(() => {
    const saved = localStorage.getItem('php_token')
    if (saved) goTo(pageForRole(getRoleFromToken(saved)))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error_description || data.msg || 'Login failed')

      localStorage.setItem('php_token', data.access_token)
      localStorage.setItem('php_refresh_token', data.refresh_token)
      localStorage.setItem('php_email', email.trim())
      goTo(pageForRole(getRoleFromToken(data.access_token)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      setLoading(false)
    }
  }

  function devSignOut() {
    localStorage.removeItem('php_token')
    localStorage.removeItem('php_refresh_token')
    localStorage.removeItem('php_email')
    setDestination('')
    setLoading(false)
  }

  // Local-testing screen (only reachable when running on localhost)
  if (destination) {
    return (
      <div className="login-card">
        <h1>🐾 Pawkit</h1>
        <p className="login-subtitle">Signed in (local test)</p>
        <p className="login-note">
          In the real app you would now be sent to <strong>{destination}</strong>.
        </p>
        <button className="btn-login" onClick={devSignOut}>Sign out (test only)</button>
      </div>
    )
  }

  return (
    <div className="login-card">
      <h1>🐾 Pawkit</h1>
      <p className="login-subtitle">People Helping Pets — Chicago</p>
      <form onSubmit={handleSubmit}>
        <div className="login-field">
          <label htmlFor="loginEmail">Email</label>
          <input
            id="loginEmail"
            type="email"
            value={email}
            placeholder="you@peoplehelpingpets.org"
            autoComplete="username"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <PasswordField
          id="loginPassword"
          label="Password"
          placeholder="••••••••"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <button className="btn-login" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
        <p className="error-msg">{error}</p>
      </form>
    </div>
  )
}