import { useEffect, useState } from 'react'
import { sbDelete, sbGet, sbPatch } from './lib/api'
import { buildRabiesCert, certFilename, saveCertFile } from './lib/rabiesCert'
import type { Client, Pet, Vaccination } from './types'

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

const isRabies = (r: Vaccination) => (r.vaccine_name || '').toLowerCase().startsWith('rabies')

interface Props {
  pet: Pet
  client?: Client
  editable?: boolean
  refreshKey?: number
}

export default function VaccineHistory({ pet, client, editable, refreshKey = 0 }: Props) {
  const [open, setOpen] = useState(true)
  const [records, setRecords] = useState<Vaccination[] | null>(null)
  const [error, setError] = useState('')
  const [due, setDue] = useState<DueRow[] | null>(null)
  const [localKey, setLocalKey] = useState(0)
  const [editing, setEditing] = useState<Vaccination | null>(null)
  const [edit, setEdit] = useState({ lot: '', tag: '', date: '', next: '' })
  const [editMsg, setEditMsg] = useState('')

  // New pet: clear everything
  useEffect(() => {
    setRecords(null)
    setDue(null)
    setEditing(null)
    setError('')
  }, [pet.id])

  // Load (and reload after a log, edit, or delete)
  useEffect(() => {
    let cancelled = false
    sbGet<Vaccination[]>(`vaccinations?pet_id=eq.${pet.id}&order=date_given.desc`)
      .then((rows) => {
        if (cancelled) return
        setRecords(rows)
        setError('')
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load vaccines')
      })
    return () => {
      cancelled = true
    }
  }, [pet.id, refreshKey, localKey])

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

  async function downloadCert(r: Vaccination) {
    if (!client) return
    try {
      const { bytes, problems } = await buildRabiesCert(r, pet, client)
      saveCertFile(bytes, certFilename(pet, r))
      if (problems.length) alert(`Downloaded, but check the certificate:\n\n${problems.join('\n')}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Certificate failed')
    }
  }

  function startEdit(r: Vaccination) {
    setEditing(r)
    setEdit({
      lot: r.lot_number || '',
      tag: r.rabies_tag_number || r.serial_number || '',
      date: r.date_given || '',
      next: r.next_due || '',
    })
    setEditMsg('')
  }

  async function saveEdit() {
    if (!editing) return
    if (!edit.date) return setEditMsg('Date given is required.')
    try {
      const changes: Record<string, unknown> = {
        lot_number: edit.lot.trim() || null,
        date_given: edit.date,
        next_due: edit.next || null,
      }
      if (isRabies(editing)) changes.rabies_tag_number = edit.tag.trim() || null
      const rows = await sbPatch(`vaccinations?id=eq.${editing.id}`, changes)
      if (!rows.length) throw new Error('Save was not allowed')
      setEditing(null)
      setLocalKey((k) => k + 1)
    } catch (err) {
      setEditMsg(err instanceof Error ? err.message : 'Save failed')
    }
  }

  async function remove(r: Vaccination) {
    if (!confirm(`Delete the ${r.vaccine_name} record? This cannot be undone.`)) return
    try {
      const rows = await sbDelete(`vaccinations?id=eq.${r.id}`)
      if (!rows.length) throw new Error('Delete was not allowed for your account')
      setLocalKey((k) => k + 1)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    }
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

          {editing && (
            <div className="edit-box">
              <div className="pet-edit-title">Editing: {editing.vaccine_name}</div>
              {editMsg && <div className="msg error">{editMsg}</div>}
              <div className="edit-grid">
                <div>
                  <label>Lot #</label>
                  <input value={edit.lot} onChange={(e) => setEdit({ ...edit, lot: e.target.value })} />
                </div>
                {isRabies(editing) && (
                  <div>
                    <label>Rabies Tag</label>
                    <input value={edit.tag} onChange={(e) => setEdit({ ...edit, tag: e.target.value })} />
                  </div>
                )}
                <div>
                  <label>Date Given</label>
                  <input type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} />
                </div>
                <div>
                  <label>Next Due</label>
                  <input type="date" value={edit.next} onChange={(e) => setEdit({ ...edit, next: e.target.value })} />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-primary btn-small" onClick={saveEdit}>Save</button>
                <button type="button" className="btn-link" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </div>
          )}

          {records && records.length > 0 && (
            <div className="table-wrap">
              <table className="vax-table">
                <thead>
                  <tr>
                    <th>Vaccine</th>
                    <th>Lot #</th>
                    {editable && <th>Rabies Tag</th>}
                    <th>Date Given</th>
                    <th>Next Due</th>
                    <th>Administered By</th>
                    {editable && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.vaccine_name}</strong></td>
                      <td>{r.lot_number || '—'}</td>
                      {editable && <td>{r.rabies_tag_number || r.serial_number || '—'}</td>}
                      <td>{fmt(r.date_given)}</td>
                      <td>{fmt(r.next_due)}</td>
                      <td>{r.administered_by || '—'}</td>
                      {editable && (
                        <td className="row-actions">
                          <button type="button" className="pill-btn" onClick={() => startEdit(r)}>✏️</button>{' '}
                          <button type="button" className="pill-btn danger" onClick={() => remove(r)}>✕</button>
                          {client && isRabies(r) && (
                            <>{' '}<button type="button" className="pill-btn" onClick={() => downloadCert(r)}>⬇ cert</button></>
                          )}
                        </td>
                      )}
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