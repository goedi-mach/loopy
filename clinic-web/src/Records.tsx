import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import ClinicNav from './components/ClinicNav'
import { sbGet } from './lib/api'
import { dayNumber, fmtNumeric, fmtShort, todayNumber } from './lib/dates'
import type { Pet, Vaccination } from './types'
import './Intake.css'

const LIMIT = 1000
const CLIENT_COLS = 'id,name,phone,email,address,street,city,state,zip,event_date'

type Tab = 'clients' | 'vax' | 'pets'

interface ClientRow {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  street: string | null
  city: string | null
  state: string | null
  zip: string | null
  event_date: string | null
}
interface PetJoined extends Pet {
  clients: { name: string; event_date: string | null } | null
  vaccinations: Vaccination[]
}
interface VaxRow {
  key: string
  pet: Pet
  vax: Vaccination | null
  owner: string
}
interface DueRow {
  key: string
  client_id: string
  pet_name: string | null
  species: string | null
  breed: string | null
  owner_name: string | null
  owner_phone: string | null
  soonest_due: string | null
  due_dates: { vaccine_name: string; next_due: string }[] | null
}
interface Errors { clients?: string; vax?: string; due?: string }

const addr = (c: ClientRow) => [c.street, c.city, c.state, c.zip].filter(Boolean).join(', ') || c.address || ''

const speciesBadge = (s: string | null) => <span className={`badge ${s || ''}`}>{s || '—'}</span>

// Red within 60 days (or overdue), amber within 180, otherwise green
function dueInfo(iso: string | null) {
  if (!iso) return null
  const days = dayNumber(iso) - todayNumber()
  const cls = days <= 60 ? 'due-red' : days <= 180 ? 'due-amber' : 'due-green'
  const label = days < 0 ? `${fmtShort(iso)} (overdue)` : days === 0 ? `${fmtShort(iso)} (today)` : fmtShort(iso)
  return { cls, label }
}

// ── Generic sortable table ──────────────────────────────────────
interface Column<T> {
  label: string
  value: (r: T) => string // what the column sorts on
  render: (r: T) => ReactNode
  sortable?: boolean
}

function DataTable<T>({
  rows, columns, rowKey, onRowClick, empty, initialSort,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (r: T) => string
  onRowClick: (r: T) => void
  empty: string
  initialSort?: { col: number; asc: boolean }
}) {
  const [sort, setSort] = useState<{ col: number; asc: boolean } | null>(initialSort ?? null)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns[sort.col]
    return [...rows].sort((a, b) => {
      const av = col.value(a)
      const bv = col.value(b)
      if (!av && bv) return 1 // blanks always last
      if (!bv && av) return -1
      const c = av.localeCompare(bv, undefined, { numeric: true })
      return sort.asc ? c : -c
    })
  }, [rows, columns, sort])

  function clickHeader(i: number) {
    if (columns[i].sortable === false) return
    setSort((s) => (s && s.col === i ? { col: i, asc: !s.asc } : { col: i, asc: true }))
  }

  return (
    <div className="table-wrap">
      <table className="rec-table">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c.label} className={sort?.col === i ? 'sorted' : ''} onClick={() => clickHeader(i)}>
                {c.label}
                {c.sortable !== false && <span className="sort-icon">{sort?.col === i ? (sort.asc ? '↑' : '↓') : '↕'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr><td colSpan={columns.length} className="state-msg">{empty}</td></tr>
          )}
          {sorted.map((r) => (
            <tr key={rowKey(r)} onClick={() => onRowClick(r)}>
              {columns.map((c) => <td key={c.label}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const clientCols: Column<ClientRow>[] = [
  { label: 'Name', value: (c) => c.name || '', render: (c) => <span className="cell-name">{c.name || '—'}</span> },
  { label: 'Phone', value: (c) => c.phone || '', render: (c) => c.phone || '—' },
  { label: 'Email', value: (c) => c.email || '', render: (c) => <span className="cell-muted">{c.email || '—'}</span> },
  { label: 'Address', value: (c) => addr(c), render: (c) => <span className="cell-muted">{addr(c) || '—'}</span> },
  { label: 'Clinic Date', value: (c) => c.event_date || '', render: (c) => <span className="cell-muted">{fmtShort(c.event_date)}</span> },
]

const vaxCols: Column<VaxRow>[] = [
  { label: 'Pet Name', value: (r) => r.pet.name || '', render: (r) => <span className="cell-name">{r.pet.name || '—'}</span> },
  { label: 'Species', value: (r) => r.pet.species || '', render: (r) => speciesBadge(r.pet.species) },
  { label: 'Breed', value: (r) => r.pet.breed || '', render: (r) => <span className="cell-muted">{r.pet.breed || '—'}</span> },
  { label: 'Owner', value: (r) => r.owner, render: (r) => r.owner },
  { label: 'Vaccine', value: (r) => r.vax?.vaccine_name || '', render: (r) => r.vax?.vaccine_name || '—' },
  { label: 'Date Given', value: (r) => r.vax?.date_given || '', render: (r) => <span className="cell-muted">{fmtShort(r.vax?.date_given ?? null)}</span> },
  { label: 'Tag #', value: (r) => r.vax?.rabies_tag_number || '', render: (r) => <span className="cell-muted">{r.vax?.rabies_tag_number || '—'}</span> },
  { label: 'Lot #', value: (r) => r.vax?.lot_number || '', render: (r) => <span className="cell-muted">{r.vax?.lot_number || '—'}</span> },
]

const dueCols: Column<DueRow>[] = [
  { label: 'Pet Name', value: (r) => r.pet_name || '', render: (r) => <span className="cell-name">{r.pet_name || '—'}</span> },
  { label: 'Species', value: (r) => r.species || '', render: (r) => speciesBadge(r.species) },
  { label: 'Breed', value: (r) => r.breed || '', render: (r) => <span className="cell-muted">{r.breed || '—'}</span> },
  { label: 'Owner', value: (r) => r.owner_name || '', render: (r) => r.owner_name || '—' },
  { label: 'Phone', value: (r) => r.owner_phone || '', render: (r) => <span className="cell-muted">{r.owner_phone || '—'}</span> },
  {
    label: 'Next Due',
    value: (r) => r.soonest_due || '',
    render: (r) => {
      const d = dueInfo(r.soonest_due)
      return d ? <span className={`due-badge ${d.cls}`}>{d.label}</span> : '—'
    },
  },
  {
    label: 'All Due Dates',
    sortable: false,
    value: () => '',
    render: (r) =>
      r.due_dates && r.due_dates.length ? (
        <div className="due-list">
          {r.due_dates.map((d, i) => {
            const info = dueInfo(d.next_due)
            return <span key={i} className={`due-badge ${info?.cls || ''}`}>{d.vaccine_name}: {info?.label || '—'}</span>
          })}
        </div>
      ) : '—',
  },
]

// ── CSV ─────────────────────────────────────────────────────────
function csvCell(v: unknown) {
  let s = String(v ?? '')
  // Stop spreadsheets from running a cell that starts like a formula
  if (/^[=@\t\r]|^[+-](?![\d\s().-])/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') // BOM keeps accents correct in Excel
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Page ────────────────────────────────────────────────────────
export default function Records() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('clients')
  const [dateInput, setDateInput] = useState('')
  const [appliedDate, setAppliedDate] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [search, setSearch] = useState('')
  const [clients, setClients] = useState<ClientRow[] | null>(null)
  const [vaxRows, setVaxRows] = useState<VaxRow[] | null>(null)
  const [dueRows, setDueRows] = useState<DueRow[] | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [truncated, setTruncated] = useState(false)

  useEffect(() => {
    let cancelled = false
    setClients(null)
    setVaxRows(null)
    setDueRows(null)
    setErrors({})
    setTruncated(false)
    const byDate = appliedDate ? `&event_date=eq.${appliedDate}` : ''
    const petsByDate = appliedDate ? `&clients.event_date=eq.${appliedDate}` : ''

    Promise.allSettled([
      sbGet<ClientRow[]>(`clients?select=${CLIENT_COLS}&order=name.asc&limit=${LIMIT}${byDate}`),
      sbGet<PetJoined[]>(`pets?select=*,clients!inner(name,event_date),vaccinations(*)&order=name.asc&limit=${LIMIT}${petsByDate}`),
      sbGet<Omit<DueRow, 'key'>[]>(`pet_next_due?order=soonest_due.asc.nullslast&limit=${LIMIT}`),
    ]).then(([c, p, d]) => {
      if (cancelled) return
      const errs: Errors = {}
      const msg = (r: PromiseRejectedResult) => (r.reason instanceof Error ? r.reason.message : 'Could not load')
      let hitLimit = false

      if (c.status === 'fulfilled') {
        setClients(c.value)
        if (c.value.length >= LIMIT) hitLimit = true
      } else {
        setClients([])
        errs.clients = msg(c)
      }

      if (p.status === 'fulfilled') {
        if (p.value.length >= LIMIT) hitLimit = true
        const flat: VaxRow[] = []
        for (const pet of p.value) {
          const list = [...pet.vaccinations].sort((a, b) => (b.date_given || '').localeCompare(a.date_given || ''))
          const owner = pet.clients?.name || '—'
          if (!list.length) flat.push({ key: pet.id, pet, vax: null, owner })
          for (const v of list) flat.push({ key: v.id, pet, vax: v, owner })
        }
        setVaxRows(flat)
      } else {
        setVaxRows([])
        errs.vax = msg(p)
      }

      if (d.status === 'fulfilled') {
        if (d.value.length >= LIMIT) hitLimit = true
        setDueRows(d.value.map((r, i) => ({ ...r, key: String(i) })))
      } else {
        setDueRows([])
        errs.due = msg(d)
      }

      setErrors(errs)
      setTruncated(hitLimit)
    })

    return () => {
      cancelled = true
    }
  }, [appliedDate, reloadKey])

  const q = search.trim().toLowerCase()
  const has = (...vals: (string | null | undefined)[]) => vals.some((v) => (v || '').toLowerCase().includes(q))

  const shownClients = useMemo(
    () => (clients || []).filter((c) => !q || has(c.name, c.phone, c.email)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clients, q]
  )
  const shownVax = useMemo(
    () => (vaxRows || []).filter((r) => !q || has(r.pet.name, r.owner, r.pet.breed, r.pet.species)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vaxRows, q]
  )
  const shownDue = useMemo(
    () => (dueRows || []).filter((r) => !q || has(r.pet_name, r.owner_name, r.owner_phone, r.breed, r.species)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dueRows, q]
  )

  const count = (shown: number, total: number | undefined, noun: string) => {
    if (total === undefined) return ''
    const label = `${total} ${noun}${total !== 1 ? 's' : ''}`
    return q ? `${shown} of ${label}` : label
  }

  function load() {
    setAppliedDate(dateInput)
    setReloadKey((k) => k + 1)
  }
  function allDates() {
    setDateInput('')
    setAppliedDate('')
    setReloadKey((k) => k + 1)
  }

  function exportClients() {
    downloadCsv('php_clients.csv', [
      ['Name', 'Phone', 'Email', 'Address', 'Clinic Date'],
      ...shownClients.map((c) => [c.name, c.phone, c.email, addr(c), fmtNumeric(c.event_date)]),
    ])
  }
  function exportVax() {
    downloadCsv('php_pets_vaccines.csv', [
      ['Pet Name', 'Species', 'Breed', 'Owner', 'Vaccine', 'Date Given', 'Tag #', 'Lot #'],
      ...shownVax.map((r) => [
        r.pet.name, r.pet.species, r.pet.breed, r.owner,
        r.vax?.vaccine_name, fmtNumeric(r.vax?.date_given ?? null), r.vax?.rabies_tag_number, r.vax?.lot_number,
      ]),
    ])
  }

  const error = tab === 'clients' ? errors.clients : tab === 'vax' ? errors.vax : errors.due
  const loading = tab === 'clients' ? !clients : tab === 'vax' ? !vaxRows : !dueRows

  return (
    <div className="intake">
      <ClinicNav active="records" />
      <div className="records-main">
        <div className="records-head">
          <div className="page-title">📋 Clinic Records</div>
          <a className="reminder-link" href="/tools/reminders.html">🔔 Reminder Manager</a>
        </div>

        <div className="controls">
          <label>Clinic Date:</label>
          <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
          <button type="button" className="btn-primary btn-small" onClick={load}>Load</button>
          <button type="button" className="btn-outline" onClick={allDates}>All dates</button>
          <input
            className="search-box"
            type="text"
            value={search}
            placeholder="Search name, phone, email…"
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="btn-outline" disabled={!clients} onClick={exportClients}>⬇ Export Clients CSV</button>
          <button type="button" className="btn-outline" disabled={!vaxRows} onClick={exportVax}>⬇ Export Pets & Vaccines CSV</button>
        </div>

        <div className="tabs">
          <button type="button" className={tab === 'clients' ? 'tab active' : 'tab'} onClick={() => setTab('clients')}>👤 Clients</button>
          <button type="button" className={tab === 'vax' ? 'tab active' : 'tab'} onClick={() => setTab('vax')}>💉 Vaccination Records</button>
          <button type="button" className={tab === 'pets' ? 'tab active' : 'tab'} onClick={() => setTab('pets')}>🐾 Pets</button>
        </div>

        {truncated && (
          <div className="warning-bar">A list reached the {LIMIT}-row limit, so some records may be missing. Narrow it with a clinic date.</div>
        )}

        <div className="card">
          <div className="card-header">
            <span>{tab === 'clients' ? 'Clients' : tab === 'vax' ? 'Vaccination Records' : 'Pets'}</span>
            <span className="record-count">
              {tab === 'clients' && count(shownClients.length, clients?.length, 'record')}
              {tab === 'vax' && count(shownVax.length, vaxRows?.length, 'record')}
              {tab === 'pets' && count(shownDue.length, dueRows?.length, 'pet')}
            </span>
          </div>
          {error && <div className="state-msg bad">Error: {error}</div>}
          {!error && loading && <div className="state-msg">Loading…</div>}
          {!error && !loading && tab === 'clients' && (
            <DataTable rows={shownClients} columns={clientCols} rowKey={(c) => c.id} empty="No clients found."
              onRowClick={(c) => navigate(`/client/${c.id}`)} />
          )}
          {!error && !loading && tab === 'vax' && (
            <DataTable rows={shownVax} columns={vaxCols} rowKey={(r) => r.key} empty="No pets found."
              onRowClick={(r) => navigate(`/client/${r.pet.client_id}`)} />
          )}
          {!error && !loading && tab === 'pets' && (
            <DataTable rows={shownDue} columns={dueCols} rowKey={(r) => r.key} empty="No pets found."
              initialSort={{ col: 5, asc: true }} onRowClick={(r) => navigate(`/client/${r.client_id}`)} />
          )}
        </div>
      </div>
    </div>
  )
}