import { useState } from 'react'
import { sbGet } from './lib/api'
import { saveCertFile } from './lib/rabiesCert'
import { buildWaiverPdf } from './lib/waiverPdf'
import type { Client } from './types'

interface Visit {
  id: string
  event_date: string | null
  waiver_signed_at: string | null
  signed: boolean
}

const fmt = (iso: string | null) => {
  if (!iso) return 'Unknown date'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// Quote a value for use inside a PostgREST "or" filter
const q = (v: string) => `"${v.replace(/"/g, '')}"`

export default function Attendance({ client }: { client: Client }) {
  const [open, setOpen] = useState(false)
  const [visits, setVisits] = useState<Visit[] | null>(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  async function load() {
    const conds: string[] = []
    if (client.email) conds.push(`email.eq.${q(client.email)}`)
    if (client.phone) conds.push(`phone.eq.${q(client.phone)}`)
    if (!conds.length) {
      setVisits([])
      return
    }
    try {
      // The signature image itself is NOT loaded here (it is large); only whether one exists
      const rows = await sbGet<Array<{ id: string; event_date: string | null; waiver_signed_at: string | null; has_sig: string | null }>>(
        `clients?or=(${conds.join(',')})&order=event_date.desc.nullslast&select=id,event_date,waiver_signed_at,has_sig:waiver_signature.not.is.null`
      )
      setVisits(rows.map((r) => ({ id: r.id, event_date: r.event_date, waiver_signed_at: r.waiver_signed_at, signed: !!r.waiver_signed_at })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load visits')
    }
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && !visits) load()
  }

  async function downloadWaiver(v: Visit) {
    setBusyId(v.id)
    try {
      const rows = await sbGet<Array<{ event_date: string | null; waiver_signature: string | null; waiver_signed_at: string | null }>>(
        `clients?id=eq.${v.id}&select=event_date,waiver_signature,waiver_signed_at`
      )
      const row = rows[0]
      if (!row?.waiver_signature) throw new Error('No signature is saved for this visit')
      const bytes = await buildWaiverPdf({ ...row, waiver_signature: row.waiver_signature }, client)
      const name = (client.name || 'client').replace(/\s+/g, '_').replace(/[^\w\-]/g, '')
      saveCertFile(bytes, `Waiver_${name}_${row.event_date || 'unknown'}.pdf`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Waiver PDF failed')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <button type="button" className="section-toggle" onClick={toggle}>
          <span>📅 Attendance / Event History</span>
          <span className={open ? 'toggle-icon open' : 'toggle-icon'}>▼</span>
        </button>
      </div>
      {open && (
        <div className="card-body">
          {error && <div className="empty-state error">Error: {error}</div>}
          {!visits && !error && <div className="empty-state">Loading…</div>}
          {visits && visits.length === 0 && <div className="empty-state">No visits on record (or no contact info to match).</div>}
          {visits && visits.length > 0 && (
            <>
              <div className="table-wrap">
                <table className="vax-table">
                  <thead>
                    <tr><th>#</th><th>Clinic Date</th><th>Waiver Signed</th><th></th></tr>
                  </thead>
                  <tbody>
                    {visits.map((v, i) => (
                      <tr key={v.id}>
                        <td className="muted">{visits.length - i}</td>
                        <td><strong>{fmt(v.event_date)}</strong></td>
                        <td>
                          {v.signed ? (
                            <>
                              <span className="signed-yes">✓ Signed</span>{' '}
                              <span className="muted small">
                                {v.waiver_signed_at && new Date(v.waiver_signed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                              </span>
                            </>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          {v.signed && (
                            <button type="button" className="btn-outline" disabled={busyId === v.id} onClick={() => downloadWaiver(v)}>
                              {busyId === v.id ? '⏳' : '⬇ Waiver'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="field-note">{visits.length} visit{visits.length !== 1 ? 's' : ''} on record</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}