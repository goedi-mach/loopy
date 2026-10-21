import { useRef, useState } from 'react'
import type { ClinicEvent } from './EventsCard'
import { sbPatch, sbPost } from './lib/api'
import './Intake.css'

const VACCINES = ['Rabies', 'DAPP', 'Lepto', 'FVRCP']

interface WasteRow {
  key: number
  vaccine: string
  doses: string
}

interface Props {
  ev: ClinicEvent
  onClose: () => void
  onDone: () => void
}

export default function CloseOutDialog({ ev, onClose, onDone }: Props) {
  const nextKey = useRef(2)
  const wasteSaved = useRef(false) // so a retry never saves the same waste twice
  const [rows, setRows] = useState<WasteRow[]>([{ key: 1, vaccine: '', doses: '' }])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const dateLabel = new Date(ev.event_date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })

  function update(key: number, patch: Partial<WasteRow>) {
    setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  async function finish(withWaste: boolean) {
    setMsg('')
    const entries: { event_id: string; vaccine_name: string; doses_wasted: number }[] = []
    if (withWaste) {
      for (const r of rows) {
        if (!r.vaccine && !r.doses) continue // skip empty rows
        const doses = parseInt(r.doses, 10)
        if (!r.vaccine) return setMsg('Please select a vaccine type for each row.')
        if (!doses || doses < 1) return setMsg('Please enter a valid dose count for each row.')
        entries.push({ event_id: ev.id, vaccine_name: r.vaccine, doses_wasted: doses })
      }
    }

    setBusy(true)
    try {
      if (entries.length && !wasteSaved.current) {
        await sbPost('vaccine_waste', entries)
        wasteSaved.current = true
      }
      await sbPatch(`events?id=eq.${ev.id}`, { completed: true, completed_at: new Date().toISOString() })
      // Clear today's check-in statuses so the next clinic starts fresh
      await sbPatch(`clients?archived=eq.false&event_date=eq.${ev.event_date}`, {
        status: null,
        checked_in_at: null,
        seen_at: null,
      })
      onDone()
    } catch (err) {
      const base = err instanceof Error ? err.message : 'Could not close out the event'
      setMsg(wasteSaved.current ? `${base} (Waste was already saved. Just try again.)` : base)
      setBusy(false)
    }
  }

  return (
    <div className="sh-modal-overlay">
      <div className="sh-modal">
        <div className="sh-modal-title">🗑️ Log Vaccine Waste</div>
        <div className="sh-modal-sub">{ev.location} · {dateLabel}</div>

        {rows.map((r) => (
          <div key={r.key} className="sh-waste-row">
            <select value={r.vaccine} onChange={(e) => update(r.key, { vaccine: e.target.value })}>
              <option value="">— Vaccine —</option>
              {VACCINES.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={99}
              placeholder="Doses"
              value={r.doses}
              onChange={(e) => update(r.key, { doses: e.target.value })}
            />
            <button type="button" title="Remove" onClick={() => setRows(rows.filter((x) => x.key !== r.key))}>✕</button>
          </div>
        ))}

        <button
          type="button"
          className="sh-add-row"
          onClick={() => setRows([...rows, { key: nextKey.current++, vaccine: '', doses: '' }])}
        >
          + Add vaccine
        </button>

        {msg && <div className="warning-bar">{msg}</div>}

        <div className="sh-modal-actions">
          <button type="button" className="btn-primary" disabled={busy} onClick={() => finish(true)}>
            {busy ? 'Saving…' : 'Save & Complete Event'}
          </button>
          <button type="button" className="btn-outline" disabled={busy} onClick={() => finish(false)}>
            No Waste — Complete
          </button>
        </div>
        <button type="button" className="sh-cancel" disabled={busy} onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}