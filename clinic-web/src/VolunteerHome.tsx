import { Link, useNavigate } from 'react-router-dom'
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

            <Link to="/intake" className="btn-mode btn-intake">
        🏥 Intake
        <span className="btn-mode-sub">Register clients &amp; check in</span>
      </Link>

      <Link to="/discharge" className="btn-mode btn-discharge">
        💉 Discharge
        <span className="btn-mode-sub">Log vaccines &amp; microchips</span>
      </Link>

      <button type="button" className="sign-out" onClick={signOut}>
        Sign out
      </button>
    </div>
  )
}