import { useEffect, useRef, useState } from 'react'
import SignaturePad from 'signature_pad'
import { sbGet, sbPost } from './lib/api'
import { emptyPet, formToPayload, type PetFormValues } from './lib/petForm'
import PetFields from './PetFields'
import type { Client } from './types'

// Local date as YYYY-MM-DD
function todayStr() {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

interface Props {
  onSaved: (client: Client) => void
  onUseExisting: (client: Client) => void
  onClose: () => void
}

export default function WalkIn({ onSaved, onUseExisting, onClose }: Props) {
  const [c, setC] = useState({ name: '', phone: '', email: '', street: '', city: '', state: '', zip: '' })
  const [pet, setPet] = useState<PetFormValues>(emptyPet)
  const [dupes, setDupes] = useState<Client[]>([])
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  // If the client saves but the pet fails, remember the client so a retry only adds the pet
  const [created, setCreated] = useState<Client | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let lastWidth = 0

    function size() {
      if (!canvas || canvas.offsetWidth === lastWidth) return // ignore height-only resizes (tablet address bars)
      lastWidth = canvas.offsetWidth
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      canvas.getContext('2d')?.scale(ratio, ratio)
      padRef.current?.clear()
    }

    padRef.current = new SignaturePad(canvas, { penColor: '#1a1a2e', minWidth: 1, maxWidth: 2.5 })
    size()
    window.addEventListener('resize', size)
    return () => {
      window.removeEventListener('resize', size)
      padRef.current?.off()
    }
  }, [])

  const setField = (field: keyof typeof c, value: string) => setC({ ...c, [field]: value })

  // Advisory only: warn if a similar client already exists
  async function checkDuplicates() {
    const tokens = c.name.trim().split(/\s+/).filter((t) => t.length >= 2)
    if (!tokens.length || created) return
    try {
      const rows: Client[] = await sbGet(
        `rpc/search_clients_unaccent?search_term=${encodeURIComponent(tokens[0])}`
      )
      setDupes(rows.slice(0, 5))
    } catch {
      // ignore: the duplicate check is a nice-to-have
    }
  }

  async function submit() {
    if (!c.name.trim()) return setMsg('Client name is required.')
    if (!pet.name.trim()) return setMsg('Pet name is required.')
    if (!pet.species) return setMsg('Please select a species.')
    setSaving(true)
    setMsg('')
    try {
      let client = created
      if (!client) {
        const pad = padRef.current
        const sig = pad && !pad.isEmpty() ? pad.toDataURL('image/png') : null
        const rows = await sbPost<Client>('clients', {
          name: c.name.trim(),
          phone: c.phone.trim() || null,
          email: c.email.trim() || null,
          street: c.street.trim() || null,
          city: c.city.trim() || null,
          state: c.state.trim().toUpperCase() || null,
          zip: c.zip.trim() || null,
          status: 'registered',
          event_date: todayStr(),
          waiver_signature: sig,
          waiver_signed_at: sig ? new Date().toISOString() : null,
        })
        if (!rows.length) throw new Error('Could not save the client')
        client = rows[0]
        setCreated(client)
      }

      try {
        await sbPost('pets', { client_id: client.id, ...formToPayload(pet) })
      } catch (err) {
        setMsg(
          `${client.name} was saved, but the pet was not: ${err instanceof Error ? err.message : 'unknown error'}. ` +
            'Click Save again to retry the pet only (the client will not be duplicated).'
        )
        return
      }
      onSaved(client)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <span>🚶 Walk-in Registration</span>
        <button type="button" className="close-btn" title="Close" onClick={onClose}>✕</button>
      </div>
      <div className="card-body">
        {msg && <div className="msg error">{msg}</div>}

        {dupes.length > 0 && !created && (
          <div className="dupe-warning">
            <div className="dupe-title">⚠️ Possible duplicate — does this client already exist?</div>
            {dupes.map((d) => (
              <div key={d.id} className="dupe-item">
                <div>
                  <div className="dupe-name">{d.name}</div>
                  <div className="dupe-meta">{[d.phone, d.email].filter(Boolean).join(' · ') || 'No contact info'}</div>
                </div>
                <button type="button" className="dupe-use" onClick={() => onUseExisting(d)}>Use this client</button>
              </div>
            ))}
            <button type="button" className="dupe-dismiss" onClick={() => setDupes([])}>
              No, this is a new client — continue anyway
            </button>
          </div>
        )}

        <div className="form-row">
          <div className="form-field">
            <label>Client Name *</label>
            <input value={c.name} placeholder="Jane Smith" onChange={(e) => setField('name', e.target.value)} onBlur={checkDuplicates} />
          </div>
          <div className="form-field">
            <label>Phone</label>
            <input type="tel" value={c.phone} placeholder="(773) 555-0100" onChange={(e) => setField('phone', e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label>Email</label>
          <input type="email" value={c.email} placeholder="correo@ejemplo.com" onChange={(e) => setField('email', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Street</label>
          <input value={c.street} placeholder="123 Main St" onChange={(e) => setField('street', e.target.value)} />
        </div>
        <div className="form-row">
          <div className="form-field">
            <label>City</label>
            <input value={c.city} placeholder="Chicago" onChange={(e) => setField('city', e.target.value)} />
          </div>
          <div className="form-field">
            <label>State</label>
            <input maxLength={2} value={c.state} placeholder="IL" onChange={(e) => setField('state', e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label>ZIP</label>
          <input maxLength={10} value={c.zip} placeholder="60601" onChange={(e) => setField('zip', e.target.value)} />
        </div>

        <hr className="walkin-divider" />
        <PetFields values={pet} onChange={setPet} />

        <div className="form-field">
          <label>Client Signature <span className="muted">(waiver)</span></label>
          <div className="sig-box">
            <canvas ref={canvasRef} className="sig-canvas" />
          </div>
          <div className="sig-clear-row">
            <button type="button" className="btn-link small" onClick={() => padRef.current?.clear()}>Clear signature</button>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-primary" disabled={saving} onClick={submit}>
            {saving ? 'Saving…' : 'Save & Check In'}
          </button>
          <button type="button" className="btn-link" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}