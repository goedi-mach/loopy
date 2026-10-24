import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sbGetAll } from './lib/api'
import { downloadCsv } from './lib/csv'
import { fmtShort, todayStr } from './lib/dates'
import './Intake.css'

interface LookupVax {
  id: string
  vaccine_name: string | null
  date_given: string
  lot_number: string | null
  administered_by: string | null
  pets: {
    id: string
    name: string | null
    species: string | null
    client_id: string | null
    clients: { id: string; name: string | null } | null
  } | null
}

interface Row {
  id: string
  date: string
  pet: string
  species: string
  owner: string
  clientId: string | null
  vaccine: string
  lot: string
  by: string
}

type Tab = 'lot' | 'staff'

const SELECT = 'id,vaccine_name,date_given,lot_number,administered_by,pets(id,name,species,client_id,clients(id,name))'
const BAR_COLORS = ['#1a3a8f', '#f28b82', '#2d8a5e', '#d97706', '#7c3aed', '#4a6cc0', '#d96b62']

function toRow(v: LookupVax): Row {
  return {
    id: v.id,
    date: v.date_given,
    pet: v.pets?.name || '—',
    species: v.pets?.species || '—',
    owner: v.pets?.clients?.name || '—',
    clientId: v.pets?.client_id || null,
    vaccine: v.vaccine_name || '—',
    lot: v.lot_number || '—',
    by: v.administered_by || '—',
  }
}

export default function VaccineLookup() {
  const [tab, setTab] = useState<Tab>('lot')
  const [lotInput, setLotInput] = useState('')
  const [staffList, setStaffList] = useState<string[]>([])
  const [staff, setStaff] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Fill the staff dropdown with every name that has given a vaccine
  useEffect(() => {
    sbGetAll<{ administered_by: string | null }>(
      'vaccinations?select=administered_by&administered_by=not.is.null&order=id.asc'
    )
      .then((list) => {
        const names = [...new Set(list.map((r) => r.administered_by).filter((n): n is string => !!n))]
        setStaffList(names.sort((a, b) => a.localeCompare(b)))
      })
      .catch(() => setStaffList([]))
  }, [])

  function switchTab(next: Tab) {
    setTab(next)
    setRows(null)
    setError('')
  }

  async function search(e: React.FormEvent) {
    e.preventDefault()
    const value = tab === 'lot' ? lotInput.trim() : staff
    if (!value) {
      setRows(null)
      setError(tab === 'lot' ? 'Please enter a lot number.' : 'Please select a staff member.')
      return
    }
    setLoading(true)
    setError('')
    setRows(null)
    try {
      const column = tab === 'lot' ? 'lot_number' : 'administered_by'
      const data = await sbGetAll<LookupVax>(
        `vaccinations?select=${SELECT}&${column}=eq.${encodeURIComponent(value)}&order=date_given.asc,id.asc`
      )
      setRows(data.map(toRow))
      setLabel(value)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  function exportCsv() {
    if (!rows?.length) return
    downloadCsv(`php-lookup-${tab}-${todayStr()}.csv`, [
      ['Date', 'Pet', 'Species', 'Owner', 'Vaccine', 'Lot #', 'Administered By'],
      ...rows.map((r) => [r.date, r.pet, r.species, r.owner, r.vaccine, r.lot, r.by]),
    ])
  }

  // Counts by vaccine type (shown for both searches)
  const counts = new Map<string, number>()
  rows?.forEach((r) => counts.set(r.vaccine, (counts.get(r.vaccine) || 0) + 1))
  const byType = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const maxCount = byType[0]?.[1] || 1

  return (
    <div className="card">
      <div className="card-header">
        <span>🔍 Vaccine Lookup</span>
        <button type="button" className="btn-outline" disabled={!rows?.length} onClick={exportCsv}>⬇ Export CSV</button>
      </div>
      <div className="card-body">
        <div className="rep-tabs">
          <button type="button" className={tab === 'lot' ? 'rep-tab active' : 'rep-tab'} onClick={() => switchTab('lot')}>
            By Lot Number
          </button>
          <button type="button" className={tab === 'staff' ? 'rep-tab active' : 'rep-tab'} onClick={() => switchTab('staff')}>
            By Staff Member
          </button>
        </div>

        <form className="rep-lookup-row" onSubmit={search}>
          {tab === 'lot' ? (
            <input
              type="text"
              value={lotInput}
              placeholder="Enter lot number…"
              onChange={(e) => setLotInput(e.target.value)}
            />
          ) : (
            <select value={staff} onChange={(e) => setStaff(e.target.value)}>
              <option value="">— Select staff member —</option>
              {staffList.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          )}
          <button type="submit" className="btn-primary btn-small" disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {error && <div className="warning-bar">{error}</div>}
        {!error && !loading && rows === null && (
          <div className="empty-state">
            {tab === 'lot' ? 'Enter a lot number to search.' : 'Select a staff member to search.'}
          </div>
        )}
        {rows && rows.length === 0 && (
          <div className="empty-state">
            {tab === 'lot' ? 'No vaccinations found for that lot number.' : 'No vaccinations found for this staff member.'}
          </div>
        )}

        {rows && rows.length > 0 && (
          <>
            <div className="rep-lookup-meta">
              <span className="rep-badge">{tab === 'lot' ? `📦 Lot: ${label}` : `👤 ${label}`}</span>
              <span className="rep-badge">{rows.length} dose{rows.length === 1 ? '' : 's'} given</span>
              {tab === 'lot' && byType.length === 1 && <span className="rep-badge">💉 {byType[0][0]}</span>}
              {tab === 'lot' && byType.length > 1 && (
                <span className="rep-badge bad">⚠ {byType.length} different vaccines share this lot number</span>
              )}
            </div>

            {byType.length > 1 && (
              <div className="rep-bars rep-lookup-bars">
                {byType.map(([name, count], i) => (
                  <div key={name} className="rep-bar-row">
                    <div className="rep-bar-label" title={name}>{name}</div>
                    <div className="rep-bar-track">
                      <div className="rep-bar-fill" style={{ width: `${(count / maxCount) * 100}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
                    </div>
                    <div className="rep-bar-count">{count}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="table-wrap">
              <table className="rec-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Pet</th><th>Species</th><th>Owner</th><th>Vaccine</th><th>Lot #</th><th>Administered By</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{fmtShort(r.date)}</td>
                      <td>{r.clientId ? <Link to={`/client/${r.clientId}`}>{r.pet}</Link> : r.pet}</td>
                      <td>{r.species}</td>
                      <td>{r.owner}</td>
                      <td>{r.vaccine}</td>
                      <td>{r.lot}</td>
                      <td>{r.by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}