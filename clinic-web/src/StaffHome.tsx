import ClinicNav from './components/ClinicNav'
import EventsCard from './EventsCard'
import { getRole } from './lib/auth'
import './Intake.css'

const TOOLS = [
  { href: '/tools/reminders.html', icon: '📬', label: 'Reminders', sub: 'Email templates & send history' },
  { href: '/tools/batch-certs.html', icon: '📄', label: 'Batch Certificates', sub: 'Download all rabies certs by date' },
  { href: '/tools/merge-clients.html', icon: '👯', label: 'Merge Tool', sub: 'Merge duplicate client records' },
]

export default function StaffHome() {
  const isAdmin = getRole() === 'admin'
  return (
    <div className="intake">
      <ClinicNav active="staff" />
      <div className="records-main">
        <div className="sh-section">Tools</div>
        <div className="sh-tiles">
          {TOOLS.map((t) => (
            <a key={t.href} href={t.href} className="sh-tile">
              <div className="sh-tile-icon">{t.icon}</div>
              <div className="sh-tile-label">{t.label}</div>
              <div className="sh-tile-sub">{t.sub}</div>
            </a>
          ))}
          {isAdmin && (
            <a href="/tools/user-management.html" className="sh-tile">
              <div className="sh-tile-icon">👥</div>
              <div className="sh-tile-label">User Management</div>
              <div className="sh-tile-sub">Invite users & manage roles</div>
            </a>
          )}
        </div>

        <div className="sh-section">Clinic Events</div>
        <EventsCard />
      </div>
    </div>
  )
}