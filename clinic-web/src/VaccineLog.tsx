import { useEffect, useState } from 'react'
import { sbGet, sbPost } from './lib/api'
import { todayStr } from './lib/dates'
import { DURATIONS, VACCINE_OPTIONS, calcNextDue } from './lib/vaccines'
import type { Pet, Vaccination, VaccineLot } from './types'

const PRODUCT_BY_MFR: Record<string, string> = { MER: 'IMRAB 3', ELA: 'RABVAC 3' }

interface Props {
  pet: Pet
  onLogged: () => Promise<void> | void
}

export default function VaccineLog({ pet, onLogged }: Props) {
  const [lots, setLots] = useState<VaccineLot[]>([])
  const [lotsError, setLotsError] = useState('')
  const [open, setOpen] = useState(true)
  const [vaxIdx, setVaxIdx] = useState('')
  const [durIdx, setDurIdx] = useState('')
  const [lot, setLot] = useState('')
  const [date, setDate] = useState(todayStr())
  const [nextDue, setNextDue] = useState('')
  const [admin, setAdmin] = useState('Dr. Ana Valbuena')
  const [tag, setTag] = useState('')
  const [colors, setColors] = useState(pet.colors_markings || '')
  const [dose, setDose] = useState('')
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    sbGet<VaccineLot[]>('vaccine_inventory?active=eq.true&order=lot_number.asc')
      .then(setLots)
      .catch((err) => setLotsError(err instanceof Error ? err.message : 'Could not load lots'))
  }, [])

  // Start fresh whenever a different pet is selected
  useEffect(() => {
    setVaxIdx('')
    setDurIdx('')
    setLot('')
    setTag('')
    setDose('')
    setColors(pet.colors_markings || '')
    setMsg(null)
  }, [pet.id, pet.colors_markings])

  const options = VACCINE_OPTIONS[pet.species || ''] || []
  const vax = vaxIdx === '' ? null : options[+vaxIdx]
  const durations = vax ? DURATIONS[vax.inventoryKey] || [] : []
  const dur = durIdx === '' ? null : durations[+durIdx]
  const lotChoices = vax ? lots.filter((l) => l.vaccine_type === vax.inventoryKey) : []
  const selectedLot = lotChoices.find((l) => l.lot_number === lot) || null
  const expired = !!selectedLot?.exp_date && !!date && selectedLot.exp_date < date
  const mfr = (selectedLot?.manufacturer || '').toUpperCase()

  // Next due follows the date and duration
  useEffect(() => {
    setNextDue(dur && date ? calcNextDue(date, dur) : '')
  }, [date, dur])

  function onVaxChange(value: string) {
    setVaxIdx(value)
    setDurIdx('')
    setMsg(null)
    const v = value === '' ? null : options[+value]
    const choices = v ? lots.filter((l) => l.vaccine_type === v.inventoryKey) : []
    setLot(choices.length === 1 ? choices[0].lot_number : '')
  }

  const fail = (text: string) => setMsg({ type: 'error', text })

  async function submit() {
    if (!vax) return fail('Please select a vaccine.')
    if (!dur) return fail('Please select a duration.')
    if (!lot.trim()) return fail('Please select a lot number.')
    if (!date) return fail('Please enter the date given.')
    if (expired) return fail(`This lot expired on ${selectedLot?.exp_date}. Please use a different lot.`)

    setSaving(true)
    setMsg(null)
    try {
      const name = `${vax.label} ${dur.label}`
      const payload: Record<string, unknown> = {
        pet_id: pet.id,
        vaccine_name: name,
        lot_number: lot.trim(),
        manufacturer: selectedLot?.manufacturer || null,
        date_given: date,
        next_due: nextDue || null,
        administered_by: admin || null,
        exp_date: selectedLot?.exp_date || null,
      }
      if (vax.isRabies) {
        payload.rabies_tag_number = tag.trim() || null
        payload.colors_markings = colors.trim() || pet.colors_markings || null
        payload.product_name = PRODUCT_BY_MFR[mfr] || null
        payload.manufacturer = mfr || null
        payload.usda_duration = dur.usda || null
        payload.dose_type = dose || null
      }
      const rows = await sbPost<Vaccination>('vaccinations', payload)
      if (!rows.length) throw new Error('The vaccine record was not saved')

      setMsg({ type: 'success', text: `${name} logged for ${pet.name}!` })
      // Clear the vaccine fields but keep the date for the next one
      setVaxIdx('')
      setDurIdx('')
      setLot('')
      setTag('')
      setDose('')
      await onLogged()
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <button type="button" className="section-toggle" onClick={() => setOpen(!open)}>
          <span>💉 Log a Vaccine</span>
          <span className={open ? 'toggle-icon open' : 'toggle-icon'}>▼</span>
        </button>
      </div>
      {open && (
        <div className="card-body">
          <p className="field-note" style={{ marginTop: 0, marginBottom: '0.85rem' }}>
            Logging for: <strong>{pet.name}</strong>
          </p>
          {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
          {lotsError && <div className="msg error">Could not load lots: {lotsError}</div>}

          <div className="form-row">
            <div className="form-field">
              <label>Vaccine Name *</label>
              <select value={vaxIdx} onChange={(e) => onVaxChange(e.target.value)}>
                <option value="">— Select —</option>
                {options.map((o, i) => (
                  <option key={o.label} value={i}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Lot / Serial # *</label>
              {lotChoices.length > 0 ? (
                <select value={lot} onChange={(e) => setLot(e.target.value)}>
                  <option value="">— Select a lot —</option>
                  {lotChoices.map((l) => (
                    <option key={l.id} value={l.lot_number}>{l.lot_number}</option>
                  ))}
                </select>
              ) : (
                <input value={lot} placeholder="ABC123" onChange={(e) => setLot(e.target.value)} />
              )}
              {vax && lotChoices.length === 0 && (
                <div className="field-note warn">No active lot on file for {vax.label}. Type it in, and ask an admin to add it to inventory.</div>
              )}
              {selectedLot?.exp_date && (
                <div className={expired ? 'field-note bad' : 'field-note ok'}>
                  {expired ? '⚠️ Expired' : '✓ Exp'} {selectedLot.exp_date}
                  {expired ? ' — cannot log this vaccine' : ''}
                </div>
              )}
            </div>
          </div>

          {vax && (
            <div className="form-field">
              <label>Duration *</label>
              <select value={durIdx} onChange={(e) => setDurIdx(e.target.value)}>
                <option value="">— Select —</option>
                {durations.map((d, i) => (
                  <option key={d.label} value={i}>{d.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-row">
            <div className="form-field">
              <label>Date Given *</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Next Due</label>
              <input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
            </div>
          </div>

          <div className="form-field">
            <label>Administered By</label>
            <select value={admin} onChange={(e) => setAdmin(e.target.value)}>
              <option value="Dr. Ana Valbuena">Dr. Ana Valbuena</option>
            </select>
          </div>

          {vax?.isRabies && (
            <div className="rabies-box">
              <div className="rabies-title">📋 NASPHV Form 51 — Rabies Certificate Fields</div>
              <div className="form-row">
                <div className="form-field">
                  <label>Rabies Tag #</label>
                  <input value={tag} placeholder="e.g. 2025-00123" onChange={(e) => setTag(e.target.value)} />
                </div>
                <div className="form-field">
                  <label>Colors / Markings</label>
                  <input value={colors} placeholder="e.g. Black & white, tabby" onChange={(e) => setColors(e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Vaccine Product Name</label>
                  <input value={PRODUCT_BY_MFR[mfr] || ''} readOnly />
                </div>
                <div className="form-field">
                  <label>Manufacturer (first 3 letters)</label>
                  <input value={mfr} readOnly />
                </div>
              </div>
              <p className="field-note">Product and manufacturer come from the selected lot. If either is wrong or blank, notify an admin.</p>
              {selectedLot && !mfr && (
                <p className="field-note warn">This lot has no manufacturer on record, so the product will be blank on the certificate.</p>
              )}
              <p className="field-note">ℹ️ IMRAB is a killed (inactivated) vaccine.</p>
              <div className="form-row">
                <div className="form-field">
                  <label>USDA License Duration</label>
                  <input value={dur?.usda === '3yr' ? '3-Year vaccine' : dur?.usda === '1yr' ? '1-Year vaccine' : ''} readOnly />
                </div>
                <div className="form-field">
                  <label>Dose Type</label>
                  <select value={dose} onChange={(e) => setDose(e.target.value)}>
                    <option value="">— Select —</option>
                    <option value="initial">Initial</option>
                    <option value="booster">Booster</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="form-actions" style={{ marginTop: '0.5rem' }}>
            <button type="button" className="btn-coral" disabled={saving} onClick={submit}>
              {saving ? 'Saving…' : 'Log Vaccine'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}