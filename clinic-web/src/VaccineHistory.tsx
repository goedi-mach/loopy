import { useEffect, useState } from 'react'
import { sbGet } from './lib/api'
import type { Pet, Vaccination } from './types'

const REQUIRED_VAX: Record<string, string[]> = {
  dog: ['Rabies', 'DAPP', 'Lepto'],
  cat: ['Rabies', 'FVRCP'],
}
const DUE_GRACE_DAYS = 30

interface DueRow {
  base: string
  tag: 'due-never' | 'due-now' | 'due-ok'
  label: string
}

// Parse YYYY-MM-DD as a plain calendar date (no time-of-day, so no off-by-one)
function dayNumber(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

function todayNumber() {
  const t = new Date()
  return Math.floor(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) / 86400000)
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function VaccineHistory({ pet }: { pet: Pet }) {
  const [open, setOpen] = useState(true)
  const [records, setRecords] = useState<Vaccination[] | null>(null)
  const [error, setError] = useState('')
  const [due, setDue] = useState<DueRow[] | null>(null)

  useEffect(() => {
    setRecords(null)
    setDue(null)
    setError('')
    sbGet<Vaccination[]>(`vaccinations?pet_id=eq.${pet.id}&order=date_given.desc`)
      .then(setRecords)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load vaccines'))
  }, [pet.id])

  function checkDue() {
    if (!records) return
    const required = REQUIRED_VAX[pet.species || ''] || []
    const today = todayNumber()
    const rows: DueRow[] = required.map((base) => {
      const latest = records.find((r) => (r.vaccine_name || '').startsWith(base))
      if (!latest) return { base, tag: 'due-never', label: 'Never given — needs initial dose' }
      if (!latest.next_due) {
        return { base, tag: 'due-now', label: `Last given ${fmt(latest.date_given)} — no next-due date on record` }
      }
      const daysUntil = dayNumber(latest.next_due) - today
      if (daysUntil <= DUE_GRACE_DAYS) {
        return {
          base,
          tag: 'due-now',
          label: daysUntil < 0 ? `Overdue since ${fmt(latest.next_due)}` : `Due now (due ${fmt(latest.next_due)})`,
        }
      }
      return { base, tag: 'due-ok', label: `Not due until ${fmt(latest.next_due)}` }
    })
    setDue(rows)
  }

  return (
    <div className="card">
      <div className="card-header">
        <button type="button" className="section-toggle" onClick={() => setOpen(!open)}>
          <span>📋 Vaccine History — {pet.name}</span>
          <span className={open ? 'toggle-icon open' : 'toggle-icon'}>▼</span>
        </button>
      </div>
      {open && (
        <div className="card-body">
          {error && <div className="empty-state error">Error: {error}</div>}
          {!records && !error && <div className="empty-state">Loading…</div>}
          {records && records.length === 0 && (
            <div className="empty-state">No vaccines on record for {pet.name}.</div>
          )}
          {records && records.length > 0 && (
            <div className="table-wrap">
              <table className="vax-table">
                <thead>
                  <tr>
                    <th>Vaccine</th><th>Lot #</th><th>Date Given</th><th>Next Due</th><th>Administered By</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.vaccine_name}</strong></td>
                      <td>{r.lot_number || '—'}</td>
                      <td>{fmt(r.date_given)}</td>
                      <td>{fmt(r.next_due)}</td>
                      <td>{r.administered_by || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {records && (
            <div className="due-wrap">
              <button type="button" className="btn-primary btn-small" onClick={checkDue}>🔍 What's Due?</button>
              {due && (
                <div className="due-results">
                  {due.map((r) => (
                    <div key={r.base} className="due-row">
                      <strong>{r.base}</strong>
                      <span className={`due-tag ${r.tag}`}>{r.label}</span>
                    </div>
                  ))}
                  {due.length === 0 && <div className="empty-state">No required vaccines defined for this species.</div>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}