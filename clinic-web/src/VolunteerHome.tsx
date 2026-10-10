import { useNavigate } from 'react-router-dom'
import { clearSession } from './lib/auth'
import './VolunteerHome.css'

export default function VolunteerHome() {
  const navigate = useNavigate()
  const email = localStorage.getItem('php_email')

  function signOut() {
    clearSession()
    navigate('/login')
  }

  return (
    <div className="card">
      <h2>🐾 Pawkit</h2>
      <p className="subtitle">People Helping Pets — Chicago</p>

      {email && <p className="user-label">👋 Signed in as {email}</p>}

      <a href="/intake.html" className="btn-mode btn-intake">
        🏥 Intake
        <span className="btn-mode-sub">Register clients &amp; check in</span>
      </a>

      <a href="/discharge.html" className="btn-mode btn-discharge">
        💉 Discharge
        <span className="btn-mode-sub">Log vaccines &amp; microchips</span>
      </a>

      <button type="button" className="sign-out" onClick={signOut}>
        Sign out
      </button>
    </div>
  )
}