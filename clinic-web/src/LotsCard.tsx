import { useCallback, useEffect, useState } from 'react'
import { sbGet, sbGetAll, sbPatch, sbPost } from './lib/api'
import { todayStr } from './lib/dates'
import './Intake.css'

interface Lot {
  id: string
  vaccine_type: string
  label: string
  lot_number: string
  manufacturer: string | null
  active: boolean
  archived: boolean
  created_at: string
  exp_date: string | null
}

interface Msg {
  type: 'error' | 'success'
  text: string
}

const VAX_LABELS: Record<string, string> = {
  rabies: 'Rabies',
  dapp: 'DAPP',
  dapp_lepto: 'Lepto',
  fvrcp: 'FVRCP',
}

const emptyForm = { type: '', lot: '', maker: '', exp: '' }

const fmtDate = (d: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

// Date n months before today (Chicago), as YYYY-MM-DD
function monthsAgo(n: number) {
  const d = new Date(todayStr() + 'T12:00:00')
  d.setMonth(d.getMonth() - n)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const errText = (err: unknown, fallback = 'Something went wrong') => (err instanceof Error ? err.message : fallback)

export default function LotsCard() {
  const [lots, setLots] = useState<Lot[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [msg, setMsg] = useState<Msg | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [sweeping, setSweeping] = useState(false)

  const load = useCallback(async () => {
    const filter = showArchived ? '' : 'archived=eq.false&'
    try {
      const rows: Lot[] = await sbGet(`vaccine_inventory?${filter}order=vaccine_type.asc,created_at.desc,id.asc`)
      setLots(rows)
      setLoadError('')
    } catch (err) {
      setLoadError(errText(err, 'Could not load lots'))
    }
  }, [showArchived])

  useEffect(() => {
    load()
  }, [load])

  // Messages fade after 5 seconds
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 5000)
    return () => clearTimeout(t)
  }, [msg])

  async function change(confirmText: string, id: string, body: Record<string, unknown>, okText: string) {
    if (!confirm(confirmText)) return
    try {
      await sbPatch(`vaccine_inventory?id=eq.${id}`, body)
      setMsg({ type: 'success', text: okText })
      await load()
    } catch (err) {
      setMsg({ type: 'error', text: errText(err) })
    }
  }

  const deactivate = (id: string) =>
    change(
      'Deactivate this lot? Discharge volunteers will no longer see it.',
      id,
      { active: false, archived: true, deactivated_at: new Date().toISOString() },
      'Lot deactivated.'
    )

  const reactivate = (id: string) =>
    change(
      'Reactivate this lot? It will become active again.',
      id,
      { active: true, archived: false, deactivated_at: null },
      'Lot reactivated.'
    )

  const archive = (id: string) =>
    change(
      'Archive this lot? It will be hidden from the list. You can still view it with "Show archived".',
      id,
      { archived: true },
      'Lot archived.'
    )

  async function save() {
    const lot = form.lot.trim()
    const maker = form.maker.trim().toUpperCase() || null
    const bad = (text: string) => setMsg({ type: 'error', text })
    if (!form.type) return bad('Please select a vaccine type.')
    if (!lot) return bad('Please enter a lot number.')
    if (!form.exp) return bad('Please enter an expiration date.')
    if (form.exp < todayStr()) return bad('This lot is already expired.')

    setSaving(true)
    try {
      // If this vaccine + lot number was entered before (even archived), update it instead of adding a duplicate
      const existing: { id: string }[] = await sbGet(
        `vaccine_inventory?vaccine_type=eq.${form.type}&lot_number=eq.${encodeURIComponent(lot)}&select=id`
      )
      if (existing.length) {
        await sbPatch(`vaccine_inventory?id=eq.${existing[0].id}`, {
          manufacturer: maker,
          active: true,
          archived: false,
          deactivated_at: null,
          exp_date: form.exp,
        })
      } else {
        await sbPost('vaccine_inventory', {
          vaccine_type: form.type,
          label: VAX_LABELS[form.type],
          lot_number: lot,
          manufacturer: maker,
          active: true,
          exp_date: form.exp,
        })
      }
      setMsg({ type: 'success', text: `Lot saved for ${VAX_LABELS[form.type]}.` })
      setForm(emptyForm)
      await load()
    } catch (err) {
      bad(errText(err, 'Save failed'))
    } finally {
      setSaving(false)
    }
  }

  async function sweep() {
    setSweeping(true)
    try {
      const cutoff = monthsAgo(3)
      // Lots not yet archived
      const open: Lot[] = await sbGet('vaccine_inventory?archived=eq.false&select=id,lot_number,active,created_at')
      // Lot numbers used on any vaccination in the last 3 months
      const recent = await sbGetAll<{ lot_number: string }>(
        `vaccinations?select=lot_number&date_given=gte.${cutoff}&lot_number=not.is.null&order=id.asc`
      )
      const recentLots = new Set(recent.map((v) => v.lot_number))

      const stale = open.filter((l) => l.created_at < cutoff && !recentLots.has(l.lot_number))
      if (!stale.length) {
        setMsg({ type: 'success', text: 'No stale lots found. Everything looks current.' })
        return
      }
      if (!confirm(`${stale.length} lot(s) haven't had a vaccination in 3+ months. Archive them now?`)) return

      const activeIds = stale.filter((l) => l.active).map((l) => l.id)
      const inactiveIds = stale.filter((l) => !l.active).map((l) => l.id)
      if (activeIds.length) {
        await sbPatch(`vaccine_inventory?id=in.(${activeIds.join(',')})`, {
          active: false,
          archived: true,
          deactivated_at: new Date().toISOString(),
        })
      }
      if (inactiveIds.length) {
        await sbPatch(`vaccine_inventory?id=in.(${inactiveIds.join(',')})`, { archived: true })
      }
      setMsg({ type: 'success', text: `Archived ${stale.length} stale lot(s).` })
      await load()
    } catch (err) {
      setMsg({ type: 'error', text: errText(err) })
    } finally {
      setSweeping(false)
    }
  }

  const today = todayStr()
  const toggle = (
    <button type="button" className="sh-linkbtn" onClick={() => setShowArchived(!showArchived)}>
      {showArchived ? 'Hide archived' : 'Show archived'}
    </button>
  )

  return (
    <div className="card">
      <div className="card-header"><span>💉 Active Vaccine Lots</span></div>
      <div className="card-body">
        <p className="field-note">
          Set the active lot number for each vaccine type. Discharge volunteers will see these automatically, so there is no manual entry.
        </p>

        {msg && <div className={msg.type === 'error' ? 'warning-bar' : 'sh-success'}>{msg.text}</div>}

        <div className="sh-sweep">
          <button type="button" className="btn-outline" disabled={sweeping} onClick={sweep}>
            {sweeping ? 'Checking…' : '🧹 Sweep Stale Lots (3+ mo)'}
          </button>
        </div>

        {loadError && <div className="warning-bar">Error: {loadError}</div>}
        {!lots && !loadError && <div className="empty-state">Loading…</div>}
        {lots && lots.length === 0 && <div className="empty-state">No lots configured yet.</div>}

        {lots && lots.length > 0 && (
          <div className="table-wrap">
            <table className="rec-table">
              <thead>
                <tr><th>Vaccine</th><th>Lot #</th><th>Manufacturer</th><th>Expires</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {lots.map((l) => (
                  <tr key={l.id} style={l.active ? undefined : { opacity: 0.5 }}>
                    <td><strong>{VAX_LABELS[l.vaccine_type] || l.vaccine_type}</strong></td>
                    <td className="sh-mono">{l.lot_number}</td>
                    <td className="sh-mono">{l.manufacturer || '—'}</td>
                    <td>
                      {fmtDate(l.exp_date)}
                      {l.active && l.exp_date && l.exp_date < today && <span className="sh-pill bad">Expired</span>}
                    </td>
                    <td>{l.active ? <span className="sh-pill done">active</span> : <span className="sh-pill off">inactive</span>}</td>
                    <td>
                      {l.active ? (
                        <button type="button" className="sh-mini red" onClick={() => deactivate(l.id)}>Deactivate</button>
                      ) : (
                        <span className="sh-event-actions">
                          <button type="button" className="sh-mini green" onClick={() => reactivate(l.id)}>Reactivate</button>
                          {!l.archived && <button type="button" className="sh-mini" onClick={() => archive(l.id)}>Archive</button>}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="sh-toggle">{toggle}</div>

        <div className="sh-add">
          <div className="sh-add-title">➕ Add / Replace a Lot</div>
          <div className="sh-row">
            <div className="sh-field">
              <label>Vaccine Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="">— Select —</option>
                {Object.entries(VAX_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="sh-field">
              <label>Lot Number</label>
              <input type="text" value={form.lot} placeholder="e.g. A12345B" onChange={(e) => setForm({ ...form, lot: e.target.value })} />
            </div>
          </div>
          <div className="sh-row">
            <div className="sh-field">
              <label>Manufacturer</label>
              <input
                type="text"
                value={form.maker}
                placeholder="e.g. MER, ELA"
                style={{ textTransform: 'uppercase' }}
                onChange={(e) => setForm({ ...form, maker: e.target.value })}
              />
            </div>
            <div className="sh-field">
              <label>Expiration Date *</label>
              <input type="date" value={form.exp} onChange={(e) => setForm({ ...form, exp: e.target.value })} />
            </div>
          </div>
          <button type="button" className="btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save Lot'}
          </button>
        </div>
      </div>
    </div>
  )
}