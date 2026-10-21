import { Link, useNavigate } from 'react-router-dom'
import { clearSession, getRole } from '../lib/auth'

type Active = 'intake' | 'discharge' | 'records' | 'reports' | 'staff' | 'batch' | 'merge'

const TITLES: Record<Active, string> = {
  intake: 'Intake',
  discharge: 'Discharge',
  records: 'Records',
  reports: 'Reports',
  staff: 'Staff',
  batch: 'Batch Certificates',
  merge: 'Merge Tool',
}

export default function ClinicNav({ active }: { active?: Active }) {
  const navigate = useNavigate()
  const email = localStorage.getItem('php_email')
  const isStaff = ['staff', 'admin'].includes(getRole() || '')
  const title = active ? TITLES[active] : 'Client Profile'

  function logout() {
    clearSession()
    navigate('/login')
  }

  const cls = (name: Active) => (active === name ? 'nav-link active' : 'nav-link')

  return (
    <nav className="topnav">
      <div className="topnav-brand">🐾 {title} — People Helping Pets</div>
      <div className="topnav-right">
        {email && <div className="topnav-user">👋 {email}</div>}
        <Link to="/intake" className={cls('intake')}>🏥 Intake</Link>
        <Link to="/discharge" className={cls('discharge')}>💉 Discharge</Link>
        <Link to="/records" className={cls('records')}>📋 Records</Link>
        {isStaff && <Link to="/reports" className={cls('reports')}>📊 Reports</Link>}
        {isStaff && <Link to="/staff-home" className={cls('staff')}>🏠 Staff Home</Link>}
        <button type="button" className="btn-logout" onClick={logout}>Sign Out</button>
      </div>
    </nav>
  )
}