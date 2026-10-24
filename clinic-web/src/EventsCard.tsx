import { useCallback, useEffect, useState } from 'react'
import { sbDelete, sbGet, sbPatch, sbPost } from './lib/api'
import { todayStr } from './lib/dates'
import './Intake.css'

export interface ClinicEvent {
  id: string
  location: string | null
  event_date: string
  start_time: string | null
  end_time: string | null
  clinic_type: string | null
  completed: boolean
}

interface EventForm {
  location: string
  date: string
  start: string
  end: string
  type: string
}

const emptyForm: EventForm = { location: '', date: '', start: '', end: '', type: '' }

const fmtLong = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

// "14:30:00" -> "2:30 PM"
function fmtClock(t: string | null) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = Number(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

function validate(f: EventForm) {
  if (!f.location.trim()) return 'Location is required.'
  if (!f.date) return 'Date is required.'
  if (!f.start) return 'Start time is required.'
  return ''
}

function toPayload(f: EventForm) {
  return {
    location: f.location.trim(),
    event_date: f.date,
    start_time: f.start,
    end_time: f.end || null,
    clinic_type: f.type || null,
  }
}

function EventFields({ form, onChange }: { form: EventForm; onChange: (f: EventForm) => void }) {
  const set = (k: keyof EventForm) => (e: { target: { value: string } }) => onChange({ ...form, [k]: e.target.value })
  return (
    <>
      <div className="sh-field">
        <label>Location *</label>
        <input type="text" value={form.location} placeholder="Pilsen Community Center" onChange={set('location')} />
      </div>
      <div className="sh-row">
        <div className="sh-field">
          <label>Date *</label>
          <input type="date" value={form.date} onChange={set('date')} />
        </div>
        <div className="sh-field">
          <label>Start Time *</label>
          <input type="time" value={form.start} onChange={set('start')} />
        </div>
      </div>
      <div className="sh-row">
        <div className="sh-field">
          <label>End Time</label>
          <input type="time" value={form.end} onChange={set('end')} />
        </div>
        <div className="sh-field">
          <label>Clinic Type</label>
          <select value={form.type} onChange={set('type')}>
            <option value="">— Select —</option>
            <option value="Vaccine Clinic">Vaccine Clinic</option>
            <option value="Booster Clinic">Booster Clinic</option>
          </select>
        </div>
      </div>
    </>
  )
}

function EditDialog({ ev, onClose, onSaved }: { ev: ClinicEvent; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<EventForm>({
    location: ev.location || '',
    date: ev.event_date,
    start: (ev.start_time || '').slice(0, 5),
    end: (ev.end_time || '').slice(0, 5),
    type: ev.clinic_type || '',
  })
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    const problem = validate(form)
    if (problem) return setMsg(problem)
    setSaving(true)
    try {
      await sbPatch(`events?id=eq.${ev.id}`, toPayload(form))
      onSaved()
      onClose()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed')
      setSaving(false)
    }
  }

  return (
    <div className="sh-modal-overlay" onClick={onClose}>
      <div className="sh-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sh-modal-title">✏️ Edit Event</div>
        <EventFields form={form} onChange={setForm} />
        {msg && <div className="warning-bar">{msg}</div>}
        <div className="sh-modal-actions">
          <button type="button" className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

interface Props {
  reloadKey?: number // bump this to make the list reload
  onComplete?: (ev: ClinicEvent) => void // buttons appear only when these are provided
  onEmail?: (ev: ClinicEvent) => void
}

export default function EventsCard({ reloadKey = 0, onComplete, onEmail }: Props) {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [showAll, setShowAll] = useState(false)
  const [events, setEvents] = useState<ClinicEvent[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState<ClinicEvent | null>(null)
  const [form, setForm] = useState<EventForm>(emptyForm)
  const [formMsg, setFormMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const today = todayStr()
    const path =
      tab === 'upcoming'
        ? `events?event_date=gte.${today}&completed=eq.false&order=event_date.asc,start_time.asc,id.asc&limit=100`
        : `events?or=(event_date.lt.${today},completed.eq.true)&order=event_date.desc,start_time.desc,id.asc&limit=20`
    try {
      const rows: ClinicEvent[] = await sbGet(path)
      setEvents(rows)
      setLoadError('')
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load events')
    }
  }, [tab])

  useEffect(() => {
    load()
  }, [load, reloadKey])

  function switchTab(next: 'upcoming' | 'past') {
    if (next === tab) return
    setEvents(null)
    setTab(next)
  }

  async function add() {
    const problem = validate(form)
    if (problem) return setFormMsg({ type: 'error', text: problem })
    setSaving(true)
    try {
      await sbPost('events', toPayload(form))
      setForm(emptyForm)
      setFormMsg({ type: 'success', text: 'Event saved!' })
      await load()
    } catch (err) {
      setFormMsg({ type: 'error', text: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  async function remove(ev: ClinicEvent) {
    if (!confirm(`Delete the event at "${ev.location}"? This cannot be undone.`)) return
    try {
      const rows = await sbDelete(`events?id=eq.${ev.id}`)
      if (!rows.length) throw new Error('Delete was not allowed for your account')
      await load()
    } catch (err) {
      alert('Delete failed: ' + (err instanceof Error ? err.message : 'unknown error'))
    }
  }

  const today = todayStr()
  const visible = events && tab === 'upcoming' && !showAll ? events.slice(0, 2) : events
  const hiddenCount = events && tab === 'upcoming' ? events.length - 2 : 0

  return (
    <div className="card">
      <div className="card-header"><span>📅 Clinic Events</span></div>
      <div className="card-body">
        <div className="sh-tabs">
          <button type="button" className={tab === 'upcoming' ? 'sh-tab active' : 'sh-tab'} onClick={() => switchTab('upcoming')}>Upcoming</button>
          <button type="button" className={tab === 'past' ? 'sh-tab active' : 'sh-tab'} onClick={() => switchTab('past')}>Past</button>
        </div>

        {loadError && <div className="warning-bar">Error: {loadError}</div>}
        {!events && !loadError && <div className="empty-state">Loading…</div>}
        {events && events.length === 0 && <div className="empty-state">No {tab} events.</div>}

        {visible?.map((e) => {
          const isPast = e.event_date < today
          return (
            <div key={e.id} className="sh-event" style={isPast && !e.completed ? { opacity: 0.6 } : undefined}>
              <div>
                <div className="sh-event-name">
                  {e.location}
                  {e.completed && <span className="sh-pill done">✓ Completed</span>}
                  {isPast && !e.completed && <span className="sh-pill warn">Not closed</span>}
                </div>
                <div className="sh-event-meta">
                  {fmtLong(e.event_date)} · {fmtClock(e.start_time)}
                  {e.end_time ? ` – ${fmtClock(e.end_time)}` : ''}
                </div>
                {e.clinic_type && <div className="sh-event-type">{e.clinic_type}</div>}
              </div>
              <div className="sh-event-actions">
                {!e.completed && onComplete && (
                  <button type="button" className="sh-mini green" onClick={() => onComplete(e)}>✓ Complete</button>
                )}
                {e.completed && onEmail && (
                  <button type="button" className="sh-mini navy" onClick={() => onEmail(e)}>✉ Post-Clinic Email</button>
                )}
                <button type="button" className="sh-mini" onClick={() => setEditing(e)}>✏️ Edit</button>
                <button type="button" className="sh-mini red" onClick={() => remove(e)}>✕ Delete</button>
              </div>
            </div>
          )
        })}

        {tab === 'upcoming' && hiddenCount > 0 && (
          <div className="sh-more">
            <button type="button" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show less' : `Show ${hiddenCount} more upcoming event${hiddenCount === 1 ? '' : 's'}`}
            </button>
          </div>
        )}

        <div className="sh-add">
          <div className="sh-add-title">➕ Add Event</div>
          {formMsg && <div className={formMsg.type === 'error' ? 'warning-bar' : 'sh-success'}>{formMsg.text}</div>}
          <EventFields form={form} onChange={(f) => { setForm(f); setFormMsg(null) }} />
          <button type="button" className="btn-primary" disabled={saving} onClick={add}>{saving ? 'Saving…' : 'Save Event'}</button>
        </div>
      </div>

      {editing && <EditDialog ev={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  )
}