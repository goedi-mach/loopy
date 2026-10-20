import { Link, useNavigate } from 'react-router-dom'
import { clearSession, getRole } from '../lib/auth'

export default function ClinicNav({ active }: { active?: 'intake' | 'discharge' }) {
  const navigate = useNavigate()
  const email = localStorage.getItem('php_email')
  const isStaff = ['staff', 'admin'].includes(getRole() || '')
  const title = active === 'intake' ? 'Intake' : active === 'discharge' ? 'Discharge' : 'Client Profile'

  function logout() {
    clearSession()
    navigate('/login')
  }

  return (
    <nav className="topnav">
      <div className="topnav-brand">🐾 {title} — People Helping Pets</div>
      <div className="topnav-right">
        {email && <div className="topnav-user">👋 {email}</div>}
        <Link to="/intake" className={active === 'intake' ? 'nav-link active' : 'nav-link'}>🏥 Intake</Link>
        <Link to="/discharge" className={active === 'discharge' ? 'nav-link active' : 'nav-link'}>💉 Discharge</Link>
        <a href="/records.html" className="nav-link">📋 Records</a>
        {isStaff && <a href="/reports.html" className="nav-link">📊 Reports</a>}
        {isStaff && <a href="/staff-home.html" className="nav-link">🏠 Staff Home</a>}
        <button type="button" className="btn-logout" onClick={logout}>Sign Out</button>
      </div>
    </nav>
  )
}