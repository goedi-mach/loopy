import { useEffect, useState } from 'react'
import ClinicNav from './components/ClinicNav'
import { request, sbGetAll } from './lib/api'
import { downloadCsv } from './lib/csv'
import { fmtShort, todayStr } from './lib/dates'
import './Intake.css'
import ReportExtras from './ReportExtras'
import VaccineLookup from './VaccineLookup'
import { Link } from 'react-router-dom'

interface VaxRow {
  id: string
  vaccine_name: string | null
  date_given: string
  pet_id: string | null
  pets: { id: string; client_id: string; species: string | null } | null
}
interface EventLite {
  id: string
  event_date: string
  location: string | null
  clinic_type: string | null
  completed: boolean
}
interface PerDate {
  date: string
  location: string
  vaccines: number
  pets: number
  clients: number
}
interface Result {
  totalVax: number
  clients: number
  pets: number
  chips: string
  events: number
  byType: [string, number][]
  species: { dog: number; cat: number; other: number }
  perDate: PerDate[]
}

const BAR_COLORS = ['#1a3a8f', '#f28b82', '#2d8a5e', '#d97706', '#7c3aed', '#4a6cc0', '#d96b62']

function Donut({ segs }: { segs: { label: string; count: number; color: string }[] }) {
  const total = segs.reduce((s, x) => s + x.count, 0)
  const r = 40
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="rep-donut">
      <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label="Species breakdown">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="20" />
        {total > 0 &&
          segs
            .filter((s) => s.count > 0)
            .map((s) => {
              const len = (s.count / total) * c
              const el = (
                <circle
                  key={s.label}
                  cx="60" cy="60" r={r} fill="none" stroke={s.color} strokeWidth="20"
                  strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}
                  transform="rotate(-90 60 60)"
                />
              )
              offset += len
              return el
            })}
        <text x="60" y="60" textAnchor="middle" dominantBaseline="central" fontWeight="700" fontSize="16" fill="#1a1a2e">{total}</text>
      </svg>
      <div className="rep-legend">
        {segs.map((s) => (
          <div key={s.label} className="rep-legend-row">
            <span className="rep-dot" style={{ background: s.color }} />
            <span>{s.label}</span>
            <strong>{s.count}</strong>
            <span className="muted small">{total ? Math.round((s.count / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Reports() {
  const [dateFrom, setDateFrom] = useState(`${new Date().getFullYear()}-01-01`)
  const [dateTo, setDateTo] = useState(todayStr())
  const [eventId, setEventId] = useState('')
  const [events, setEvents] = useState<EventLite[]>([])
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [range, setRange] = useState<{ from: string; to: string; eventDate: string | null } | null>(null)

  async function run() {
    setRunning(true)
    setError('')
    try {
      const evs = await sbGetAll<EventLite>('events?select=id,event_date,location,clinic_type,completed&order=event_date.desc,id.asc')
      setEvents(evs)

      // Picking one event overrides the date range with that event's date
      const picked = eventId ? evs.find((e) => e.id === eventId) : null
      const from = picked ? picked.event_date : dateFrom
      const to = picked ? picked.event_date : dateTo
      const vaxFilter = (from ? `&date_given=gte.${from}` : '') + (to ? `&date_given=lte.${to}` : '')
      const clientFilter = (from ? `&clients.event_date=gte.${from}` : '') + (to ? `&clients.event_date=lte.${to}` : '')

      const [vax, chipRes] = await Promise.all([
        sbGetAll<VaxRow>(
          `vaccinations?select=id,vaccine_name,date_given,pet_id,pets(id,client_id,species)${vaxFilter}&order=date_given.asc,id.asc`
        ),
        request(`/rest/v1/pets?select=id,clients!inner(id)&microchip_number=not.is.null${clientFilter}`, {
          method: 'HEAD',
          headers: { Prefer: 'count=exact' },
        }),
      ])

      const eventsInRange = evs.filter((e) => (!from || e.event_date >= from) && (!to || e.event_date <= to))
      const eventByDate = new Map(eventsInRange.map((e) => [e.event_date, e]))

      const types = new Map<string, number>()
      const petIds = new Set<string>()
      const clientIds = new Set<string>()
      const species = { dog: 0, cat: 0, other: 0 }
      const seenPet = new Set<string>()
      const byDate = new Map<string, { vax: number; pets: Set<string>; clients: Set<string> }>()

      for (const v of vax) {
        const name = v.vaccine_name || 'Unknown'
        types.set(name, (types.get(name) || 0) + 1)

        let d = byDate.get(v.date_given)
        if (!d) byDate.set(v.date_given, (d = { vax: 0, pets: new Set(), clients: new Set() }))
        d.vax++

        if (v.pet_id) {
          petIds.add(v.pet_id)
          d.pets.add(v.pet_id)
          if (v.pets?.client_id) {
            clientIds.add(v.pets.client_id)
            d.clients.add(v.pets.client_id)
          }
          if (!seenPet.has(v.pet_id)) {
            seenPet.add(v.pet_id)
            const sp = (v.pets?.species || '').toLowerCase()
            if (sp === 'dog') species.dog++
            else if (sp === 'cat') species.cat++
            else species.other++
          }
        }
      }

      setResult({
        totalVax: vax.length,
        clients: clientIds.size,
        pets: petIds.size,
        chips: chipRes.headers.get('content-range')?.split('/')[1] ?? '0',
        events: eventsInRange.length,
        byType: [...types.entries()].sort((a, b) => b[1] - a[1]),
        species,
        perDate: [...byDate.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, d]) => ({
            date,
            location: eventByDate.get(date)?.location || '—',
            vaccines: d.vax,
            pets: d.pets.size,
            clients: d.clients.size,
          })),
      })
    setRange({ from, to, eventDate: picked ? picked.event_date : null })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not run the report')
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function exportEvents() {
    if (!result?.perDate.length) return
    downloadCsv(`php-report-${dateFrom}-to-${dateTo}.csv`, [
      ['Date', 'Location', 'Vaccines', 'Pets', 'Clients'],
      ...result.perDate.map((r) => [r.date, r.location, r.vaccines, r.pets, r.clients]),
    ])
  }

  const maxType = result?.byType[0]?.[1] || 1
  const totals = result?.perDate.reduce(
    (t, r) => ({ v: t.v + r.vaccines, p: t.p + r.pets, c: t.c + r.clients }),
    { v: 0, p: 0, c: 0 }
  )

  const stat = (cls: string, label: string, value: string | number | undefined, sub: string) => (
    <div className={`rep-stat ${cls}`}>
      <div className="rep-stat-label">{label}</div>
      <div className="rep-stat-value">{value === undefined ? '—' : Number(value).toLocaleString()}</div>
      <div className="muted small">{sub}</div>
    </div>
  )

  return (
    <div className="intake">
      <ClinicNav active="reports" />
      <div className="records-main">
        <div className="records-head">
          <div className="page-title">📊 Reports & Statistics</div>
          <Link className="reminder-link" to="/tools/batch-certs">📄 Batch Certificates</Link>
        </div>

        <div className="controls">
          <label>From</label>
          <input type="date" value={dateFrom} disabled={!!eventId} onChange={(e) => setDateFrom(e.target.value)} />
          <label>To</label>
          <input type="date" value={dateTo} disabled={!!eventId} onChange={(e) => setDateTo(e.target.value)} />
          <label>Event</label>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">All events</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.event_date} — {ev.location || 'No location'}</option>
            ))}
          </select>
          <button type="button" className="btn-primary btn-small" disabled={running} onClick={run}>
            {running ? 'Running…' : 'Run Report'}
          </button>
        </div>

        {error && <div className="warning-bar">Error: {error}</div>}

        <div className="rep-stats">
          {stat('navy', 'Total Vaccines Given', result?.totalVax, 'in selected range')}
          {stat('coral', 'Unique Clients Served', result?.clients, 'distinct owners')}
          {stat('green', 'Unique Pets Vaccinated', result?.pets, 'distinct animals')}
          {stat('amber', 'Microchips on File', result?.chips, 'pets of clients in range')}
          {stat('purple', 'Clinic Events', result?.events, 'in selected range')}
        </div>

        <div className="rep-two">
          <div className="card">
            <div className="card-header"><span>💉 Vaccines by Type</span></div>
            <div className="card-body">
              {!result && <div className="empty-state">Loading…</div>}
              {result && result.byType.length === 0 && <div className="empty-state">No vaccinations in this range.</div>}
              <div className="rep-bars">
                {result?.byType.map(([name, count], i) => (
                  <div key={name} className="rep-bar-row">
                    <div className="rep-bar-label" title={name}>{name}</div>
                    <div className="rep-bar-track">
                      <div className="rep-bar-fill" style={{ width: `${(count / maxType) * 100}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
                    </div>
                    <div className="rep-bar-count">{count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span>🐾 Species Breakdown</span></div>
            <div className="card-body">
              {!result ? (
                <div className="empty-state">Loading…</div>
              ) : (
                <Donut
                  segs={[
                    { label: 'Dogs', count: result.species.dog, color: '#1a3a8f' },
                    { label: 'Cats', count: result.species.cat, color: '#f28b82' },
                    ...(result.species.other ? [{ label: 'Other', count: result.species.other, color: '#d97706' }] : []),
                  ]}
                />
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span>📅 Vaccines per Clinic Event</span>
            <button type="button" className="btn-outline" disabled={!result?.perDate.length} onClick={exportEvents}>⬇ Export CSV</button>
          </div>
          {!result && <div className="state-msg">Loading…</div>}
          {result && result.perDate.length === 0 && <div className="state-msg">No data in this range.</div>}
          {result && result.perDate.length > 0 && totals && (
            <div className="table-wrap">
              <table className="rec-table">
                <thead>
                  <tr><th>Date</th><th>Location</th><th>Vaccines</th><th>Pets</th><th>Clients</th></tr>
                </thead>
                <tbody>
                  {result.perDate.map((r) => (
                    <tr key={r.date}>
                      <td>{fmtShort(r.date)}</td>
                      <td>{r.location}</td>
                      <td>{r.vaccines}</td>
                      <td>{r.pets}</td>
                      <td>{r.clients}</td>
                    </tr>
                  ))}
                  <tr className="rep-total">
                    <td colSpan={2}>Totals</td>
                    <td>{totals.v}</td>
                    <td>{totals.p}</td>
                    <td>{totals.c}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
        <p className="field-note">Pets and Clients totals add up each clinic's counts, so someone seen at two clinics is counted twice. The stat cards above count each person once.</p>
        <ReportExtras range={range} events={events} />
        <VaccineLookup />
      </div>
    </div>
  )
}