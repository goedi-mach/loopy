import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { clearSession } from './lib/auth'
import { request, sbGet } from './lib/api'
import type { Client, EventRow } from './types'
import ClientDetail from './ClientDetail'
import './Intake.css'
import WalkIn from './WalkIn'

type Filter = 'all' | 'registered' | 'discharged'

const STATUS_LABEL: Record<string, string> = {
  registered: 'Registered',
  discharged: 'Discharged',
}

function getRole(): string | null {
  try {
    const token = localStorage.getItem('php_token')
    if (!token) return null
    return JSON.parse(atob(token.split('.')[1])).app_metadata?.role || null
  } catch {
    return null
  }
}

function fmtTime(t: string) {
  const [h, m] = t.split(':')
  const hour = +h
  return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

// Local date as YYYY-MM-DD (the old page used UTC, which flips to "tomorrow" in the evening)
function todayStr() {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export default function Intake() {
  const navigate = useNavigate()
  const email = localStorage.getItem('php_email')
  const isStaff = ['staff', 'admin'].includes(getRole() || '')

  const [todayEvent, setTodayEvent] = useState<EventRow | null>(null)
  const [eventsLoaded, setEventsLoaded] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [clients, setClients] = useState<Client[]>([])
  const [listMsg, setListMsg] = useState('Loading…')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Client | null>(null)
  const [count, setCount] = useState<string | null>(null)
  const [showWalkin, setShowWalkin] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const clinicType = todayEvent?.clinic_type || null

  // 1. Find today's clinic. Set the starting filter (Booster clinics start on "registered").
  useEffect(() => {
    async function loadEvent() {
      try {
        const today = todayStr()
        const events: EventRow[] = await sbGet(
          `events?event_date=eq.${today}&order=start_time.asc&limit=1`
        )
        const ev = events[0] || null
        setTodayEvent(ev)
        if (ev?.clinic_type === 'Booster Clinic') setFilter('registered')
      } catch (err) {
        setListMsg(`Error: ${err instanceof Error ? err.message : 'could not load events'}`)
      } finally {
        setEventsLoaded(true)
      }
    }
    loadEvent()
  }, [])

  // 2. Owner count for today
  useEffect(() => {
    async function loadCount() {
      try {
        const res = await request(`/rest/v1/clients?event_date=eq.${todayStr()}`, {
          method: 'HEAD',
          headers: { Prefer: 'count=exact' },
        })
        setCount(res.headers.get('content-range')?.split('/')[1] ?? '0')
      } catch {
        // the count is a nice-to-have; ignore failures
      }
    }
    loadCount()
  }, [reloadKey])

  // 3. Load the client list whenever the clinic or filter changes
  useEffect(() => {
    if (!eventsLoaded) return
    async function loadList() {
      if (!clinicType) {
        setClients([])
        setListMsg('No clinic scheduled today.')
        return
      }
      setListMsg('Loading…')
      try {
        let eventDate = todayStr()
        if (clinicType === 'Booster Clinic') {
          // Boosters work from the most recent completed vaccine clinic
          const past: EventRow[] = await sbGet(
            'events?clinic_type=eq.Vaccine Clinic&completed=eq.true&order=event_date.desc&limit=1'
          )
          if (!past.length) {
            setClients([])
            setListMsg('No previous vaccine clinic found.')
            return
          }
          eventDate = past[0].event_date
        }
        let path = `clients?archived=eq.false&event_date=eq.${eventDate}&order=created_at.asc&limit=200`
        if (filter !== 'all') path += `&status=eq.${filter}`
        const rows: Client[] = await sbGet(path)
        setClients(rows)
        setListMsg(rows.length ? '' : 'No clients found.')
      } catch (err) {
        setClients([])
        setListMsg(`Error: ${err instanceof Error ? err.message : 'could not load clients'}`)
      }
    }
    loadList()
  }, [eventsLoaded, clinicType, filter, reloadKey])

  async function search() {
    const q = query.trim()
    if (!q) {
      setListMsg('Enter a name, email, or phone.')
      setClients([])
      return
    }
    setListMsg('Searching…')
    try {
      const rows: Client[] = await sbGet(
        `rpc/search_clients_unaccent?search_term=${encodeURIComponent(q)}`
      )
      setClients(rows)
      setListMsg(rows.length ? '' : 'No clients found.')
    } catch (err) {
      setClients([])
      setListMsg(`Error: ${err instanceof Error ? err.message : 'search failed'}`)
    }
  }

  // Keep the list and the detail panel in sync after an edit or archive
  function handleUpdated(updated: Client) {
    setSelected(updated)
    setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  function handleWalkinSaved(client: Client) {
    setShowWalkin(false)
    setSelected(client)
    setReloadKey((k) => k + 1)
  }

  function handleUseExisting(client: Client) {
    setShowWalkin(false)
    setSelected(client)
  }

  function logout() {
    clearSession()
    navigate('/login')
  }

  return (
    <div className="intake">
      <nav className="topnav">
        <div className="topnav-brand">🐾 Intake — People Helping Pets</div>
        <div className="topnav-right">
          {email && <div className="topnav-user">👋 {email}</div>}
          <Link to="/intake" className="nav-link active">🏥 Intake</Link>
          <a href="/discharge.html" className="nav-link">💉 Discharge</a>
          <a href="/records.html" className="nav-link">📋 Records</a>
          {isStaff && <a href="/reports.html" className="nav-link">📊 Reports</a>}
          {isStaff && <a href="/staff-home.html" className="nav-link">🏠 Staff Home</a>}
          <button type="button" className="btn-logout" onClick={logout}>Sign Out</button>
        </div>
      </nav>

      {todayEvent && (
        <div className="clinic-banner">
          <span>📅</span>
          <span>
            Today's Clinic: {todayEvent.location} · {fmtTime(todayEvent.start_time)}
            {todayEvent.end_time ? ` – ${fmtTime(todayEvent.end_time)}` : ''}
          </span>
        </div>
      )}

      <div className="dash-body">
        <div>
          {count !== null && (
            <div className="today-count">
              👥 {count} owner{count === '1' ? '' : 's'} registered today
            </div>
          )}
          <div className="card">
            <div className="card-header">
              <span>🔍 Search Clients</span>
              <button type="button" className="btn-primary btn-small" onClick={() => setShowWalkin(true)}>+ Walk-in</button>
            </div>
            <div className="card-body">
              <div className="filter-row">
                {(['all', 'registered', 'discharged'] as Filter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={filter === f ? 'filter-btn active' : 'filter-btn'}
                    onClick={() => setFilter(f)}
                  >
                    {f === 'all' ? 'All' : STATUS_LABEL[f]}
                  </button>
                ))}
              </div>

              <div className="search-wrap">
                <input
                  type="text"
                  value={query}
                  placeholder="Name, email, or phone…"
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && search()}
                />
                <button type="button" className="btn-search" onClick={search}>Search</button>
              </div>

              <ul className="client-list">
                {listMsg && <li className="empty-state">{listMsg}</li>}
                {clients.map((c) => (
                  <li
                    key={c.id}
                    className={c.id === selected?.id ? 'client-item selected' : 'client-item'}
                    style={c.archived ? { opacity: 0.45 } : undefined}
                    onClick={() => setSelected(c)}
                  >
                    <div className="client-row">
                      <div className="client-name">{c.name}</div>
                      {c.archived ? (
                        <span className="badge badge-archived">Archived</span>
                      ) : (
                        c.status && STATUS_LABEL[c.status] && (
                          <span className={`badge badge-${c.status}`}>{STATUS_LABEL[c.status]}</span>
                        )
                      )}
                    </div>
                    <div className="client-meta">
                      {[c.phone, c.email].filter(Boolean).join(' · ') || 'No contact info'}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

                  <div>
          {showWalkin ? (
            <WalkIn
              onSaved={handleWalkinSaved}
              onUseExisting={handleUseExisting}
              onClose={() => setShowWalkin(false)}
            />
          ) : selected ? (
            <ClientDetail key={selected.id} client={selected} onUpdated={handleUpdated} />
          ) : (
            <div className="card">
              <div className="card-body">
                <div className="empty-state">Select a client to see their details.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}