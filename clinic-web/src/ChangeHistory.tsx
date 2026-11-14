import { useEffect, useState } from 'react'
import { sbGet } from './lib/api'
import { getRole } from './lib/auth'

// One row from the vaccination_history table (filled in by a database trigger)
interface HistoryRow {
  id: number
  vaccination_id: string
  action: 'UPDATE' | 'DELETE'
  changed_at: string
  changed_by_email: string | null
  changed_fields: string[] | null
  old_row: Record<string, unknown>
  new_row: Record<string, unknown> | null
}

const FIELD_LABELS: Record<string, string> = {
  vaccine_name: 'Vaccine',
  lot_number: 'Lot #',
  rabies_tag_number: 'Rabies tag',
  serial_number: 'Serial #',
  date_given: 'Date given',
  next_due: 'Next due',
  administered_by: 'Administered by',
  exp_date: 'Lot expiration',
  product_name: 'Product',
  manufacturer: 'Manufacturer',
  usda_duration: 'Duration',
  dose_type: 'Dose type',
  colors_markings: 'Colors/markings',
}

// Show a stored value; YYYY-MM-DD dates are shown as calendar dates (no off-by-one)
function show(v: unknown) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  return String(v)
}

function when(ts: string) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

interface Props {
  petId: string
  refreshKey?: number
}

export default function ChangeHistory({ petId, refreshKey = 0 }: Props) {
  const canView = ['staff', 'admin'].includes(getRole() || '')
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<HistoryRow[] | null>(null)
  const [error, setError] = useState('')

  // Load when opened, and reload after an edit or delete on this pet
  useEffect(() => {
    if (!open || !canView) return
    let cancelled = false
    setRows(null)
    sbGet<HistoryRow[]>(`vaccination_history?pet_id=eq.${petId}&order=changed_at.desc&limit=100`)
      .then((data) => {
        if (cancelled) return
        setRows(data)
        setError('')
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load change history')
      })
    return () => {
      cancelled = true
    }
  }, [open, petId, refreshKey, canView])

  if (!canView) return null

  return (
    <div className="due-wrap">
      <button type="button" className="btn-link" onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} 🕘 Change history
      </button>

      {open && (
        <div style={{ marginTop: '0.75rem' }}>
          {error && <div className="empty-state error">Error: {error}</div>}
          {!rows && !error && <div className="empty-state">Loading…</div>}
          {rows && rows.length === 0 && (
            <div className="empty-state">No edits or deletions recorded for this pet.</div>
          )}
          {rows && rows.length > 0 && (
            <div className="table-wrap">
              <table className="vax-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>What changed</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((h) => (
                    <tr key={h.id}>
                      <td>{when(h.changed_at)}</td>
                      <td>{h.changed_by_email || 'System'}</td>
                      <td>
                        {h.action === 'DELETE' ? (
                          <>
                            <strong>Deleted</strong> {show(h.old_row.vaccine_name)} — lot {show(h.old_row.lot_number)},
                            given {show(h.old_row.date_given)}
                            {h.old_row.rabies_tag_number ? `, tag ${show(h.old_row.rabies_tag_number)}` : ''}
                          </>
                        ) : (
                          <>
                            <strong>Edited</strong> {show(h.old_row.vaccine_name)}
                            {(h.changed_fields || []).map((f) => (
                              <div key={f}>
                                {FIELD_LABELS[f] || f}: {show(h.old_row[f])} → {show(h.new_row?.[f])}
                              </div>
                            ))}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}