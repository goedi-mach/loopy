import { useEffect, useState } from 'react'
import PasswordField from './components/PasswordField'
import './SetPassword.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

type Status = 'loading' | 'form' | 'success' | 'error'

// Supabase puts the token after the # in the web address
function readToken() {
  const params = new URLSearchParams(window.location.hash.substring(1))
  return { accessToken: params.get('access_token'), type: params.get('type') }
}

export default function SetPassword() {
  const [status, setStatus] = useState<Status>('loading')
  const [token, setToken] = useState('')
  const [pwd1, setPwd1] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Runs once when the page loads: check the token with Supabase
  useEffect(() => {
    async function verify() {
      const { accessToken, type } = readToken()
      if (!accessToken || (type !== 'recovery' && type !== 'invite')) {
        setStatus('error')
        return
      }
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${accessToken}`,
          },
        })
        if (!res.ok) throw new Error('Token rejected')
        setToken(accessToken)
        setStatus('form')
      } catch {
        setStatus('error')
      }
    }
    verify()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault() // stops the browser from reloading the page
    setError('')

    if (pwd1.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (pwd1 !== pwd2) {
      setError('Passwords do not match.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: pwd1 }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.msg || data.message || 'Failed to update password')
      }
      setStatus('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="logo">🐾 Pawkit</div>
      <div className="subtitle">People Helping Pets</div>

      {status === 'loading' && <div className="loading">Verifying your link…</div>}

      {status === 'form' && (
        <form onSubmit={handleSubmit}>
          <p className="intro">Choose a new password for your account.</p>
          <PasswordField
            id="newPassword"
            label="New password"
            placeholder="At least 8 characters"
            value={pwd1}
            onChange={setPwd1}
          />
          <PasswordField
            id="confirmPassword"
            label="Confirm password"
            placeholder="Repeat password"
            value={pwd2}
            onChange={setPwd2}
          />
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Set Password'}
          </button>
          {error && <div className="msg error">{error}</div>}
        </form>
      )}

      {status === 'success' && (
        <p className="banner success">
          ✅ Password set! You can now <a href="/login.html">sign in</a>.
        </p>
      )}

      {status === 'error' && (
        <p className="banner error">
          ❌ This link is invalid or has expired. Please ask an admin to resend your invite.
        </p>
      )}
    </div>
  )
}