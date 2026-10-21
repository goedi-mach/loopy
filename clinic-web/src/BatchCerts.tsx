import { useState } from 'react'
import ClinicNav from './components/ClinicNav'
import { sbGetAll } from './lib/api'
import { todayStr } from './lib/dates'
import { buildRabiesCert } from './lib/rabiesCert'
import type { Client, Pet, Vaccination } from './types'
import './Intake.css'

type Row = Vaccination & { administered_by?: string | null } & {
  pets: (Pet & { clients: Client | null }) | null
}

const safe = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '_')

export default function BatchCerts() {
  const [date, setDate] = useState(todayStr())
  const [rows, setRows] = useState<Row[] | null>(null)
  const [loadedDate, setLoadedDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null)
  const [result, setResult] = useState<{ made: number; problems: string[] } | null>(null)

  async function load() {
    if (!date) return setError('Please select a date.')
    setLoading(true)
    setError('')
    setRows(null)
    setResult(null)
    try {
      const data = await sbGetAll<Row>(
        `vaccinations?select=*,pets(*,clients(*))&date_given=eq.${date}&vaccine_name=ilike.*Rabies*&order=id.asc`
      )
      setRows(data)
      setLoadedDate(date)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load records')
    } finally {
      setLoading(false)
    }
  }

  async function downloadAll() {
    if (!rows?.length) return
    setBusy(true)
    setResult(null)
    const problems: string[] = []
    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      const used = new Set<string>()
      let made = 0

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const pet = r.pets
        const client = pet?.clients
        if (!pet || !client) {
          problems.push(`A vaccination on ${r.date_given} has no ${pet ? 'owner' : 'pet'} on file and was skipped.`)
          continue
        }
        setProgress({ done: i, total: rows.length, label: `Generating ${i + 1} of ${rows.length}: ${pet.name}…` })

        const { bytes, problems: p } = await buildRabiesCert(r, pet, client)
        p.forEach((x) => problems.push(`${pet.name}: ${x}`))

        const ownerLast = (client.name || 'UnknownOwner').trim().split(' ').pop() || 'Owner'
        const base = `RabiesCert_${safe(pet.name || 'Pet')}_${safe(ownerLast)}_${r.date_given}`
        let name = `${base}.pdf`
        for (let n = 2; used.has(name); n++) name = `${base}_${n}.pdf`
        used.add(name)
        zip.file(name, bytes)
        made++
      }

      if (!made) throw new Error('No certificates could be generated.')
      setProgress({ done: rows.length, total: rows.length, label: 'Creating zip file…' })
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `RabiesCerts_${loadedDate}.zip`
      a.click()
      URL.revokeObjectURL(url)
      setResult({ made, problems })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the zip')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <div className="intake">
      <ClinicNav active="batch" />
      <div className="records-main">
        <div className="records-head">
          <div>
            <div className="page-title">📄 Batch Rabies Certificates</div>
            <div className="bc-sub">Generate and download all rabies certificates from a clinic date as a zip file.</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span>Select Clinic Date</span></div>
          <div className="card-body">
            <div className="bc-row">
              <div>
                <label>Clinic Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <button type="button" className="btn-primary" disabled={loading || busy} onClick={load}>
                {loading ? 'Loading…' : 'Load Certificates'}
              </button>
            </div>
            {error && <div className="warning-bar" style={{ marginTop: '1rem' }}>{error}</div>}
            {rows && rows.length === 0 && (
              <div className="empty-state">No rabies vaccinations found for {loadedDate}.</div>
            )}
          </div>
        </div>

        {rows && rows.length > 0 && (
          <div className="card">
            <div className="card-header">
              <span>{rows.length} Rabies Certificate{rows.length === 1 ? '' : 's'} — {loadedDate}</span>
              <button type="button" className="btn-primary btn-small" disabled={busy} onClick={downloadAll}>
                {busy ? 'Working…' : '⬇ Download All as ZIP'}
              </button>
            </div>

            {progress && (
              <div className="bc-progress">
                <div className="bc-sub">{progress.label}</div>
                <div className="bc-track">
                  <div className="bc-fill" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
                </div>
              </div>
            )}

            {result && (
              <div className="bc-progress">
                <div className="sh-success">✓ Downloaded {result.made} certificate{result.made === 1 ? '' : 's'} as a zip file.</div>
                {result.problems.length > 0 && (
                  <div className="warning-bar">
                    Some certificates had problems. Check these before printing:
                    <ul className="bc-problems">
                      {result.problems.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="table-wrap">
              <table className="rec-table">
                <thead>
                  <tr><th>Pet</th><th>Owner</th><th>Rabies Tag</th><th>Vaccine</th><th>Vet</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.pets?.name || '—'}</strong>
                        <div className="bc-sub">{[r.pets?.species, r.pets?.breed].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td>
                        {r.pets?.clients?.name || '—'}
                        <div className="bc-sub">{r.pets?.clients?.phone || ''}</div>
                      </td>
                      <td>
                        {r.rabies_tag_number ? (
                          <span className="sh-pill done">{r.rabies_tag_number}</span>
                        ) : (
                          <span className="sh-pill warn">No tag</span>
                        )}
                      </td>
                      <td>{r.vaccine_name || '—'}</td>
                      <td>{r.administered_by || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}