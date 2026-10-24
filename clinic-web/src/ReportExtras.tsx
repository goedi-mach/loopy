import { useEffect, useState, type ReactNode } from 'react'
import { sbGetAll } from './lib/api'
import { dayNumber, fmtShort } from './lib/dates'
import { TIER_LABEL, ZIP_DEMO, needTier } from './lib/zipDemo'
import './Intake.css'

interface EventLite {
  id: string
  event_date: string
  location: string | null
  clinic_type: string | null
  completed: boolean
}
interface Range {
  from: string
  to: string
  eventDate: string | null
}
interface VaxLite {
  date_given: string
  pets: { client_id: string } | null
}

interface State<T> {
  data: T | null
  error: string
}

// Runs a loader whenever deps change; one failing section never blanks the others
function useLoad<T>(fn: () => Promise<T>, deps: unknown[]): State<T> {
  const [state, setState] = useState<State<T>>({ data: null, error: '' })
  useEffect(() => {
    let cancelled = false
    setState({ data: null, error: '' })
    fn()
      .then((data) => !cancelled && setState({ data, error: '' }))
      .catch((e) => !cancelled && setState({ data: null, error: e instanceof Error ? e.message : 'Could not load' }))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

function Body<T>({ s, children }: { s: State<T>; children: (d: NonNullable<T>) => ReactNode }) {
  if (s.error) return <div className="state-msg bad">Error: {s.error}</div>
  if (!s.data) return <div className="state-msg">Loading…</div>
  return <>{children(s.data)}</>
}

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0)

function Split({ a, b }: { a: number; b: number }) {
  const total = a + b
  const ap = pct(a, total)
  return (
    <div className="rep-nvr">
      <div className="rep-nvr-boxes">
        <div className="rep-nvr-box new">
          <div className="rep-stat-label">🆕 New</div>
          <div className="rep-nvr-num">{a}</div>
          <div className="muted small">{ap}% of {total}</div>
        </div>
        <div className="rep-nvr-box ret">
          <div className="rep-stat-label">🔄 Returning</div>
          <div className="rep-nvr-num">{b}</div>
          <div className="muted small">{total ? 100 - ap : 0}% of {total}</div>
        </div>
      </div>
      <div className="rep-split-bar"><div style={{ width: `${ap}%` }} /></div>
    </div>
  )
}

export default function ReportExtras({ range, events }: { range: Range | null; events: EventLite[] }) {
  const [showDemo, setShowDemo] = useState(false)

  // New vs returning: a client is "returning" if vaccinated on more than one date
  const nvr = useLoad(async () => {
    if (!range) return null
    const eventDate = range.eventDate
    const vax = await sbGetAll<VaxLite>('vaccinations?select=date_given,pets(client_id)&order=id.asc')
    const datesBy = new Map<string, Set<string>>()
    for (const v of vax) {
      const cid = v.pets?.client_id
      if (!cid) continue
      let s = datesBy.get(cid)
      if (!s) datesBy.set(cid, (s = new Set()))
      s.add(v.date_given)
    }
    let n = 0
    let r = 0
    datesBy.forEach((s) => (s.size > 1 ? r++ : n++))

    let event: { new: number; ret: number } | null = null
    if (eventDate) {
      let en = 0
      let er = 0
      datesBy.forEach((s) => {
        if (!s.has(eventDate)) return
        if ([...s].some((d) => d < eventDate)) er++
        else en++
      })
      event = { new: en, ret: er }
    }
    return { new: n, ret: r, event, eventDate }
  }, [range])

  // Waste for events inside the range
  const waste = useLoad(async () => {
    if (!range) return null
    const ids = new Set(
      events
        .filter((e) => (!range.from || e.event_date >= range.from) && (!range.to || e.event_date <= range.to))
        .map((e) => e.id)
    )
    const rows = await sbGetAll<{ vaccine_name: string; doses_wasted: number; event_id: string }>(
      'vaccine_waste?select=vaccine_name,doses_wasted,event_id&order=id.asc'
    )
    const totals = new Map<string, number>()
    for (const w of rows) {
      if (!ids.has(w.event_id)) continue
      totals.set(w.vaccine_name, (totals.get(w.vaccine_name) || 0) + (w.doses_wasted || 0))
    }
    const list = [...totals.entries()].sort((a, b) => b[1] - a[1])
    return { list, total: list.reduce((s, [, n]) => s + n, 0) }
  }, [range])

  // Booster return rate, rebuilt from vaccinations (not from clients.event_date)
  const booster = useLoad(async () => {
    if (!range) return null
    const done = events.filter((e) => e.completed).sort((a, b) => a.event_date.localeCompare(b.event_date))
    const vaccineClinics = done.filter((e) => e.clinic_type === 'Vaccine Clinic')
    const boosterClinics = done.filter((e) => e.clinic_type === 'Booster Clinic')
    const pairs = vaccineClinics.flatMap((vc) => {
      const bc = boosterClinics.find((b) => {
        const diff = dayNumber(b.event_date) - dayNumber(vc.event_date)
        return diff > 0 && diff <= 60
      })
      return bc ? [{ vc, bc }] : []
    })

    const clientsOn = async (date: string) => {
      const rows = await sbGetAll<VaxLite>(`vaccinations?select=date_given,pets(client_id)&date_given=eq.${date}&order=id.asc`)
      return new Set(rows.map((r) => r.pets?.client_id).filter((x): x is string => !!x))
    }
    const rows = await Promise.all(
      pairs.map(async ({ vc, bc }) => {
        const [a, b] = await Promise.all([clientsOn(vc.event_date), clientsOn(bc.event_date)])
        const returned = [...a].filter((id) => b.has(id)).length
        return { vc, bc, total: a.size, returned, rate: pct(returned, a.size) }
      })
    )
    return rows
  }, [range])

  // ZIP codes of clients in range (first 5 digits, so ZIP+4 groups together)
  const zips = useLoad(async () => {
    if (!range) return null
    const f = (range.from ? `&event_date=gte.${range.from}` : '') + (range.to ? `&event_date=lte.${range.to}` : '')
    const rows = await sbGetAll<{ zip: string | null }>(`clients?select=zip&archived=eq.false${f}&order=id.asc`)
    const counts = new Map<string, number>()
    let total = 0
    for (const r of rows) {
      const z = (r.zip || '').trim().slice(0, 5)
      if (!z) continue
      total++
      counts.set(z, (counts.get(z) || 0) + 1)
    }
    const list = [...counts.entries()].filter(([, c]) => pct(c, total) >= 3).sort((a, b) => b[1] - a[1])
    return { total, list }
  }, [range])

  return (
    <>
      <div className="card">
        <div className="card-header"><span>🔄 New vs. Returning Clients</span></div>
        <div className="card-body">
          <Body s={nvr}>
            {(d) =>
              d.new + d.ret === 0 ? (
                <div className="empty-state">No client data available.</div>
              ) : (
                <>
                  <div className="rep-sub">📊 All time ({d.new + d.ret} clients)</div>
                  <Split a={d.new} b={d.ret} />
                  {d.event && (
                    <div className="rep-event-block">
                      <div className="rep-sub">📅 {d.eventDate && fmtShort(d.eventDate)}</div>
                      <Split a={d.event.new} b={d.event.ret} />
                    </div>
                  )}
                </>
              )
            }
          </Body>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span>🔁 Booster Return Rate</span></div>
        <Body s={booster}>
          {(rows) =>
            rows.length === 0 ? (
              <div className="state-msg">No completed Vaccine + Booster clinic pairs (within 60 days) found yet.</div>
            ) : (
              <div className="table-wrap">
                <table className="rec-table">
                  <thead>
                    <tr><th>Vaccine Clinic</th><th>Booster Clinic</th><th>Vaccinated</th><th>Returned for Booster</th><th>Return Rate</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.vc.id}>
                        <td>{fmtShort(r.vc.event_date)}<div className="cell-muted">{r.vc.location}</div></td>
                        <td>{fmtShort(r.bc.event_date)}<div className="cell-muted">{r.bc.location}</div></td>
                        <td>{r.total}</td>
                        <td>{r.returned}</td>
                        <td>
                          <span className={`due-badge ${r.rate >= 50 ? 'due-green' : r.rate >= 25 ? 'due-amber' : 'due-red'}`}>{r.rate}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </Body>
      </div>

      <div className="card">
        <div className="card-header"><span>📍 Client ZIP Codes</span>
          <button type="button" className="btn-outline" onClick={() => setShowDemo(!showDemo)}>
            {showDemo ? 'Hide demographics' : 'Show demographics'}
          </button>
        </div>
        <div className="card-body">
          <Body s={zips}>
            {(d) =>
              d.list.length === 0 ? (
                <div className="empty-state">No ZIP data in this range.</div>
              ) : (
                <>
                  <p className="field-note" style={{ marginTop: 0 }}>
                    {d.list.length} ZIP code{d.list.length !== 1 ? 's' : ''} shown (3% or more) · {d.total} client{d.total !== 1 ? 's' : ''} with a ZIP on file
                  </p>
                  {!showDemo && (
                    <div className="rep-bars">
                      {d.list.map(([zip, count]) => (
                        <div key={zip} className="rep-zip-row">
                          <span className="mono">{zip}</span>
                          <div className="rep-bar-track"><div className="rep-bar-fill" style={{ width: `${(count / d.list[0][1]) * 100}%`, background: '#1a3a8f' }} /></div>
                          <strong>{count}</strong>
                          <span className="muted small">{pct(count, d.total)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {showDemo && (
                    <div className="table-wrap">
                      <table className="rec-table">
                        <thead>
                          <tr><th>ZIP</th><th>Clients</th><th>Med. Income</th><th>Poverty</th><th>Hispanic</th><th>Black</th><th>Need</th></tr>
                        </thead>
                        <tbody>
                          {d.list.map(([zip, count]) => {
                            const z = ZIP_DEMO[zip]
                            return (
                              <tr key={zip}>
                                <td className="mono">{zip}</td>
                                <td>{count}</td>
                                <td>{z ? `$${Math.round(z.med_income / 1000)}k` : '—'}</td>
                                <td>{z ? `${z.pct_poverty.toFixed(1)}%` : '—'}</td>
                                <td>{z ? `${z.pct_hispanic.toFixed(1)}%` : '—'}</td>
                                <td>{z ? `${z.pct_black.toFixed(1)}%` : '—'}</td>
                                <td>{TIER_LABEL[needTier(z)]}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      <p className="field-note">Source: US Census ACS 2024 5-year estimates. 🔴 High = income under $50k or poverty over 20% · 🟡 Med = under $75k or over 12% · 🟢 Low = above both.</p>
                    </div>
                  )}
                </>
              )
            }
          </Body>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span>🗑️ Vaccine Waste</span></div>
        <Body s={waste}>
          {(d) =>
            d.list.length === 0 ? (
              <div className="state-msg">No vaccine waste recorded in this range.</div>
            ) : (
              <div className="card-body">
                <div className="rep-waste-total"><strong>{d.total}</strong> total doses wasted</div>
                <div className="table-wrap">
                  <table className="rec-table">
                    <thead><tr><th>Vaccine</th><th>Doses Wasted</th></tr></thead>
                    <tbody>
                      {d.list.map(([name, n]) => <tr key={name}><td>{name}</td><td>{n}</td></tr>)}
                      <tr className="rep-total"><td>Total</td><td>{d.total}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          }
        </Body>
      </div>
    </>
  )
}