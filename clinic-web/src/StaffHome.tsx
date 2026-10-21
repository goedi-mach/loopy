import { useCallback, useEffect, useState } from 'react'
import ClinicNav from './components/ClinicNav'
import CloseOutDialog from './CloseOutDialog'
import EventsCard, { type ClinicEvent } from './EventsCard'
import { request, sbGet } from './lib/api'
import { getRole } from './lib/auth'
import { todayStr } from './lib/dates'
import './Intake.css'

const TOOLS = [
  { href: '/tools/reminders.html', icon: '📬', label: 'Reminders', sub: 'Email templates & send history' },
  { href: '/tools/batch-certs.html', icon: '📄', label: 'Batch Certificates', sub: 'Download all rabies certs by date' },
  { href: '/tools/merge-clients.html', icon: '👯', label: 'Merge Tool', sub: 'Merge duplicate client records' },
]

const longDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

const shortDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// Newest past clinic that was never closed out
const staleQuery = () => `events?completed=eq.false&event_date=lt.${todayStr()}&order=event_date.desc&limit=1`

export default function StaffHome() {
  const isAdmin = getRole() === 'admin'
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

  async function sendEmail(ev: ClinicEvent) {
    const label = ev.clinic_type || 'clinic'
    if (
      !confirm(
        `Send post-clinic email to all clients from the ${label} on ${longDate(ev.event_date)} at ${ev.location}?\n\nClients without an email address on file will be skipped.`
      )
    )
      return

    try {
      const res = await request(
        `/rest/v1/clients?event_date=eq.${ev.event_date}&archived=eq.false&email=not.is.null`,
        { method: 'HEAD', headers: { Prefer: 'count=exact' } }
      )
      const count = Number(res.headers.get('content-range')?.split('/')[1] ?? 0)
      if (!count) {
        alert('No clients with email addresses found for this event.')
        return
      }
      if (!confirm(`${count} client${count === 1 ? '' : 's'} with email addresses will receive this email. Continue?`)) return

      const r = await fetch('/api/send-postclinic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('php_token')}`,
        },
        body: JSON.stringify({ eventId: ev.id, eventDate: ev.event_date, clinicType: ev.clinic_type || '' }),
      })
      const data = await r.json().catch(() => null)
      if (!r.ok) throw new Error(data?.error || `Send failed (${r.status}). The email API only runs on a deployed preview.`)
      alert(
        `✅ Post-clinic email sent to ${data.sent} client${data.sent === 1 ? '' : 's'}.` +
          (data.skipped > 0 ? ` ${data.skipped} skipped (no email on file).` : '')
      )
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'unknown error'))
    }
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
        <EventsCard reloadKey={reloadKey} onComplete={setClosing} onEmail={sendEmail} />
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