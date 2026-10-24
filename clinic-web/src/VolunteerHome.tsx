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

            <Link to="/clinic" className="btn-mode btn-intake">
        🏥 Clinic
        <span className="btn-mode-sub">Register, vaccinate &amp; discharge</span>
      </Link>

      <button type="button" className="sign-out" onClick={signOut}>
        Sign out
      </button>
    </div>
  )
}