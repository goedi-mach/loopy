import { useEffect, useState } from 'react'
import { sbPatch } from './lib/api'
import type { Pet } from './types'

interface Props {
  pet: Pet
  onChanged: () => Promise<void> | void
}

export default function MicrochipLog({ pet, onChanged }: Props) {
  const [open, setOpen] = useState(true)
  const [editing, setEditing] = useState(false)
  const [implanted, setImplanted] = useState<boolean | null>(null)
  const [number, setNumber] = useState('')
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  // Start fresh for each pet
  useEffect(() => {
    setEditing(false)
    setImplanted(null)
    setNumber('')
    setMsg(null)
  }, [pet.id])

  const locked = !!pet.microchip_number && !editing

  function startEdit() {
    setNumber(pet.microchip_number || '')
    setImplanted(true)
    setEditing(true)
    setMsg(null)
  }

  async function save() {
    const n = number.trim()
    if (!n) return setMsg({ type: 'error', text: 'Please enter a microchip number.' })
    if (!/^\d+$/.test(n)) return setMsg({ type: 'error', text: 'Microchip numbers contain digits only.' })
    if (n.length !== 15 && !confirm(`That number has ${n.length} digits, not 15. Save it anyway?`)) return

    setSaving(true)
    setMsg(null)
    try {
      const rows = await sbPatch(`pets?id=eq.${pet.id}`, { microchipped: 'yes', microchip_number: n })
      if (!rows.length) throw new Error('Save was not allowed')
      setMsg({ type: 'success', text: `Microchip ${n} saved for ${pet.name}!` })
      setEditing(false)
      setImplanted(null)
      setNumber('')
      await onChanged()
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <button type="button" className="section-toggle" onClick={() => setOpen(!open)}>
          <span>🔖 Log Microchip</span>
          <span className={open ? 'toggle-icon open' : 'toggle-icon'}>▼</span>
        </button>
      </div>
      {open && (
        <div className="card-body">
          <p className="field-note" style={{ marginTop: 0, marginBottom: '0.85rem' }}>
            Logging for: <strong>{pet.name}</strong>
          </p>
          {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

          {locked ? (
            <div className="chip-locked">
              <div>
                <div className="chip-locked-title">🔖 Microchip logged</div>
                <div className="chip-locked-number">{pet.microchip_number}</div>
              </div>
              <button type="button" className="pill-btn" onClick={startEdit}>✏️ Edit</button>
            </div>
          ) : (
            <>
              <p className="field-note" style={{ marginTop: 0 }}>Was a microchip implanted today?</p>
              <div className="chip-choice">
                <button
                  type="button"
                  className={implanted === true ? 'btn-primary btn-small' : 'btn-outline'}
                  onClick={() => setImplanted(true)}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className={implanted === false ? 'btn-primary btn-small' : 'btn-outline'}
                  onClick={() => setImplanted(false)}
                >
                  No
                </button>
              </div>
              {implanted === true && (
                <>
                  <div className="form-field">
                    <label>Microchip Number *</label>
                    <input
                      value={number}
                      inputMode="numeric"
                      maxLength={15}
                      placeholder="985112345678901"
                      onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn-primary" disabled={saving} onClick={save}>
                      {saving ? 'Saving…' : 'Save Microchip'}
                    </button>
                    {editing && (
                      <button type="button" className="btn-link" onClick={() => { setEditing(false); setImplanted(null) }}>
                        Cancel
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}