import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ClinicNav from './components/ClinicNav'
import CloseOutDialog from './CloseOutDialog'
import EventsCard, { type ClinicEvent } from './EventsCard'
import LotsCard from './LotsCard'
import { sbGet } from './lib/api'
import { getRole } from './lib/auth'
import { todayStr } from './lib/dates'
import './Intake.css'

const TOOLS = [
  { href: '/tools/reminders.html', icon: '📬', label: 'Reminders', sub: 'Email templates & send history' },
  { to: '/tools/batch-certs', icon: '📄', label: 'Batch Certificates', sub: 'Download all rabies certs by date' },
  { to: '/tools/merge-clients', icon: '👯', label: 'Merge Tool', sub: 'Merge duplicate client records' },
]


const shortDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// Newest past clinic that was never closed out
const staleQuery = () => `events?completed=eq.false&event_date=lt.${todayStr()}&order=event_date.desc&limit=1`

export default function StaffHome() {
  const isAdmin = getRole() === 'admin'
  const navigate = useNavigate()
  const [closing, setClosing] = useState<ClinicEvent | null>(null)
  const [stale, setStale] = useState<ClinicEvent | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const checkStale = useCallback(async () => {
    try {
      const rows: ClinicEvent[] = await sbGet(staleQuery())
      setStale(rows[0] || null)
    } catch {
      setStale(null)
    }
  }, [])

  useEffect(() => {
    checkStale()
  }, [checkStale, reloadKey])

  async function closeStale() {
    try {
      // Look again, in case the event was deleted or closed since the page loaded
      const rows: ClinicEvent[] = await sbGet(staleQuery())
      if (!rows.length) {
        setStale(null)
        alert('No unclosed clinic found.')
        return
      }
      setClosing(rows[0])
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'unknown error'))
    }
  }

  function openPostClinic(ev: ClinicEvent) {
    navigate(`/tools/reminders?tab=manual&event=${ev.id}`)
  }

  return (
    <div className="intake">
      <ClinicNav active="staff" />
      <div className="records-main">
        {stale && (
          <div className="sh-stale">
            <div>
              <div className="sh-stale-title">⚠️ Clinic Not Closed Out</div>
              <div className="sh-stale-text">
                The {stale.clinic_type || 'clinic'} on {shortDate(stale.event_date)} at {stale.location || 'unknown location'} was never closed out.
              </div>
            </div>
            <button type="button" onClick={closeStale}>Close &amp; Reset Now</button>
          </div>
        )}

        <div className="sh-section">Tools</div>
        <div className="sh-tiles">
            {TOOLS.map((t) => {
            const body = (
              <>
                <div className="sh-tile-icon">{t.icon}</div>
                <div className="sh-tile-label">{t.label}</div>
                <div className="sh-tile-sub">{t.sub}</div>
              </>
            )
            return t.to ? (
              <Link key={t.label} to={t.to} className="sh-tile">{body}</Link>
            ) : (
              <a key={t.label} href={t.href} className="sh-tile">{body}</a>
            )
          })}
            {isAdmin && (
            <Link to="/tools/user-management" className="sh-tile">
              <div className="sh-tile-icon">👥</div>
              <div className="sh-tile-label">User Management</div>
              <div className="sh-tile-sub">Invite users & manage roles</div>
            </Link>
          )}
          {isAdmin && (
            <Link to="/tools/settings" className="sh-tile">
              <div className="sh-tile-icon">⚙️</div>
              <div className="sh-tile-label">Settings</div>
              <div className="sh-tile-sub">Organization, vets & vaccines</div>
            </Link>
          )}
        </div>

        <div className="sh-section">Clinic Events</div>
        <EventsCard reloadKey={reloadKey} onComplete={setClosing} onEmail={openPostClinic} />
        <div className="sh-section sh-section-gap">Vaccine Lot Management</div>
        <LotsCard />
      </div>

      {closing && (
        <CloseOutDialog
          ev={closing}
          onClose={() => setClosing(null)}
          onDone={() => {
            setClosing(null)
            setReloadKey((k) => k + 1)
          }}
        />
      )}
    </div>
  )
}