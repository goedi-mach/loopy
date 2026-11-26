import { useEffect, useState } from 'react'
import { sbGet, sbPost } from './lib/api'
import { typesForSpecies, useVaccineTypes } from './lib/vaccines'
import type { Pet, VaccineDeferral } from './types'

interface Props {
  pet: Pet
  refreshKey?: number
  onSaved: () => void
}

// Lets the vet flag vaccines to give at a later clinic.
// Open flags show at the top of Vaccine History, and close on their own
// when that vaccine is logged (a database trigger handles that).
export default function DeferVaccines({ pet, refreshKey = 0, onSaved }: Props) {
  const [open, setOpen] = useState(false)
  const [alreadyFlagged, setAlreadyFlagged] = useState<string[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  // Start fresh whenever a different pet is selected
  useEffect(() => {
    setPicked([])
    setNote('')
    setMsg(null)
  }, [pet.id])

  // Which vaccines already have an open flag (so they can't be flagged twice)
  useEffect(() => {
    let cancelled = false
    sbGet<VaccineDeferral[]>(`vaccine_deferrals?pet_id=eq.${pet.id}&resolved_on=is.null&select=vaccine`)
      .then((rows) => {
        if (!cancelled) setAlreadyFlagged(rows.map((r) => r.vaccine))
      })
      .catch(() => {
        if (!cancelled) setAlreadyFlagged([])
      })
    return () => {
      cancelled = true
    }
  }, [pet.id, refreshKey])

  const types = useVaccineTypes()
  const choices = typesForSpecies(types || [], pet.species || '').map((o) => o.label)

  function toggle(vaccine: string) {
    setMsg(null)
    setPicked((p) => (p.includes(vaccine) ? p.filter((v) => v !== vaccine) : [...p, vaccine]))
  }

  async function save() {
    if (!picked.length) return setMsg({ type: 'error', text: 'Check at least one vaccine.' })
    setSaving(true)
    setMsg(null)
    try {
      const rows = await sbPost<VaccineDeferral>(
        'vaccine_deferrals',
        picked.map((vaccine) => ({ pet_id: pet.id, vaccine, note: note.trim() || null }))
      )
      if (!rows.length) throw new Error('The flag was not saved')
      setMsg({ type: 'success', text: `Flagged for next clinic: ${picked.join(', ')}` })
      setPicked([])
      setNote('')
      onSaved()
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
          <span>⏭ Give at Next Clinic</span>
          <span className={open ? 'toggle-icon open' : 'toggle-icon'}>▼</span>
        </button>
      </div>
      {open && (
        <div className="card-body">
          <p className="field-note" style={{ marginTop: 0, marginBottom: '0.85rem' }}>
            Check any vaccines the vet wants to give <strong>{pet.name}</strong> at the next clinic.
            They'll show at the top of Vaccine History next visit, and clear on their own once logged.
          </p>
          {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

          {choices.length === 0 ? (
            <div className="empty-state">No vaccines are set up for this species.</div>
          ) : (
            <>
              <div className="defer-checks">
                {choices.map((v) => {
                  const flagged = alreadyFlagged.includes(v)
                  return (
                    <label key={v} className={flagged ? 'defer-check flagged' : 'defer-check'}>
                      <input
                        type="checkbox"
                        checked={flagged || picked.includes(v)}
                        disabled={flagged}
                        onChange={() => toggle(v)}
                      />
                      {v}
                      {flagged && <span className="defer-already">already flagged</span>}
                    </label>
                  )
                })}
              </div>

              <div className="form-field">
                <label>Note (optional)</label>
                <input
                  value={note}
                  placeholder="e.g. Too young today, give next month"
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-primary btn-small" disabled={saving} onClick={save}>
                  {saving ? 'Saving…' : 'Flag for Next Clinic'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
