import { useEffect, useState, type ReactNode } from 'react'
import { sbDelete, sbGet, sbPatch, sbPost } from './lib/api'
import { emptyPet, formToPayload, petToForm, type PetFormValues } from './lib/petForm'
import PetForm from './PetForm'
import type { Pet } from './types'
import VaccineHistory from './VaccineHistory'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const REASON_LABEL: Record<string, string> = { transfer: 'Transferred', death: 'Deceased' }

interface Props {
  clientId: string
  allowDelete?: boolean
  renderSelected?: (pet: Pet, reload: () => Promise<void>) => ReactNode
}

export default function PetList({ clientId, allowDelete, renderSelected }: Props) {
  const [pets, setPets] = useState<Pet[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<PetFormValues>(emptyPet)
  const [showAdd, setShowAdd] = useState(false)
  const [addValues, setAddValues] = useState<PetFormValues>(emptyPet)
  const [formMsg, setFormMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null)
  const [archiveFor, setArchiveFor] = useState<Pet | null>(null)
  const [reason, setReason] = useState('')
  const [reasonNote, setReasonNote] = useState('')
  const [archiveMsg, setArchiveMsg] = useState('')

  async function load() {
    try {
      const rows: Pet[] = await sbGet(`pets?client_id=eq.${clientId}&order=name.asc`)
      setPets(rows)
      setLoadError('')
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load pets')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  function startEdit(p: Pet) {
    setEditingId(p.id)
    setEditValues(petToForm(p))
    setFormMsg('')
  }

  async function saveEdit() {
    if (!editValues.name.trim()) return setFormMsg('Pet name is required.')
    if (!editValues.species) return setFormMsg('Please select a species.')
    setSaving(true)
    try {
      await sbPatch(`pets?id=eq.${editingId}`, formToPayload(editValues))
      setEditingId(null)
      setFormMsg('')
      await load()
    } catch (err) {
      setFormMsg(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function saveNew() {
    if (!addValues.name.trim()) return setFormMsg('Pet name is required.')
    if (!addValues.species) return setFormMsg('Please select a species.')
    setSaving(true)
    try {
      await sbPost('pets', { client_id: clientId, ...formToPayload(addValues) })
      setAddValues(emptyPet)
      setShowAdd(false)
      setFormMsg('')
      await load()
    } catch (err) {
      setFormMsg(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function toggleArchive(p: Pet) {
    if (!p.archived) {
      // Archiving needs a reason
      setArchiveFor(p)
      setReason('')
      setReasonNote('')
      setArchiveMsg('')
      return
    }
    try {
      const rows = await sbPatch(`pets?id=eq.${p.id}`, { archived: false, archive_reason: null, archive_note: null })
      if (!rows.length) throw new Error('Save was not allowed')
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not update pet')
    }
  }

  async function confirmArchive() {
    if (!archiveFor) return
    if (!reason) return setArchiveMsg('Please select a reason.')
    if (reason === 'other' && !reasonNote.trim()) return setArchiveMsg('Please describe the reason.')
    try {
      const rows = await sbPatch(`pets?id=eq.${archiveFor.id}`, {
        archived: true,
        archive_reason: reason,
        archive_note: reason === 'other' ? reasonNote.trim() : null,
      })
      if (!rows.length) throw new Error('Save was not allowed')
      if (selectedPetId === archiveFor.id) setSelectedPetId(null)
      setArchiveFor(null)
      await load()
    } catch (err) {
      setArchiveMsg(err instanceof Error ? err.message : 'Could not archive')
    }
  }

  async function deletePet(p: Pet) {
    if (!confirm(`Permanently delete ${p.name}?\n\nThis also deletes all of their vaccination records and cannot be undone.`)) return
    try {
      const rows = await sbDelete(`pets?id=eq.${p.id}`)
      if (!rows.length) throw new Error('Delete was not allowed for your account')
      if (selectedPetId === p.id) setSelectedPetId(null)
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const selectedPet = pets?.find((p) => p.id === selectedPetId) || null

  return (
    <>
      {archiveFor && (
        <div className="modal-overlay" onClick={() => setArchiveFor(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Archive {archiveFor.name}</div>
            <p className="field-note" style={{ marginTop: 0 }}>Please select a reason for archiving this pet.</p>
            {archiveMsg && <div className="msg error">{archiveMsg}</div>}
            <label className="radio-row"><input type="radio" name="reason" checked={reason === 'transfer'} onChange={() => setReason('transfer')} /> Transferred to another owner</label>
            <label className="radio-row"><input type="radio" name="reason" checked={reason === 'death'} onChange={() => setReason('death')} /> Deceased</label>
            <label className="radio-row"><input type="radio" name="reason" checked={reason === 'other'} onChange={() => setReason('other')} /> Other</label>
            {reason === 'other' && (
              <div className="form-field" style={{ marginTop: '0.5rem' }}>
                <input value={reasonNote} placeholder="Please describe the reason…" onChange={(e) => setReasonNote(e.target.value)} />
              </div>
            )}
            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button type="button" className="btn-coral" onClick={confirmArchive}>Archive Pet</button>
              <button type="button" className="btn-link" onClick={() => setArchiveFor(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="card pets-card">
        <div className="card-header"><span>🐾 Pets</span></div>
        <div className="card-body">
          {loadError && <div className="empty-state error">Error: {loadError}</div>}
          {!pets && !loadError && <div className="empty-state">Loading…</div>}
          {pets && pets.length === 0 && <div className="empty-state">No pets on record yet.</div>}

          {pets?.map((p) =>
            editingId === p.id ? (
              <div key={p.id} className="pet-edit-box">
                <div className="pet-edit-title">Edit {p.name}</div>
                <PetForm
                  values={editValues}
                  onChange={setEditValues}
                  onSubmit={saveEdit}
                  onCancel={() => { setEditingId(null); setFormMsg('') }}
                  submitLabel="Save"
                  message={formMsg}
                  saving={saving}
                />
              </div>
            ) : (
              <div
                key={p.id}
                className={p.id === selectedPetId ? 'pet-card selected' : 'pet-card'}
                style={p.archived ? { opacity: 0.45 } : { cursor: 'pointer' }}
                onClick={() => !p.archived && setSelectedPetId(p.id)}
              >
                <div className="pet-card-top">
                  <div className="pet-photo-thumb">
                    {p.photo_updated_at ? (
                      <img
                        src={`${SUPABASE_URL}/storage/v1/object/public/pet-photos/${p.id}.jpg?t=${new Date(p.photo_updated_at).getTime()}`}
                        alt={p.name}
                      />
                    ) : p.species === 'dog' ? '🐶' : p.species === 'cat' ? '🐱' : '🐾'}
                  </div>
                  <div className="pet-info">
                    <div className="pet-card-name">
                      {p.name}
                      <span className={`badge ${p.species || ''}`}>{p.species || '?'}</span>
                      {p.archived && (
                        <span className="badge badge-archived">
                          Archived
                          {p.archive_reason
                            ? `: ${p.archive_reason === 'other' ? p.archive_note || 'Other' : REASON_LABEL[p.archive_reason] || p.archive_reason}`
                            : ''}
                        </span>
                      )}
                      {p.sex === 'male' && <span className="badge badge-male">♂ Male</span>}
                      {p.sex === 'female' && <span className="badge badge-female">♀ Female</span>}
                      {p.altered === 'yes' && <span className="badge sn-yes">S/N</span>}
                      {p.altered === 'no' && <span className="badge sn-no">Intact</span>}
                    </div>
                    <div className="pet-card-meta">
                      {p.breed && <span>{p.breed}</span>}
                      {p.age != null && <span>{p.age} {p.age_unit === 'months' ? 'mos' : 'yrs'}</span>}
                      {p.weight != null && <span>{p.weight} lbs</span>}
                      <span>
                        {p.microchipped === 'yes' ? '🔖 Microchipped' : p.microchipped === 'no' ? 'No microchip' : 'Microchip unknown'}
                      </span>
                      {p.microchip_number && <span># {p.microchip_number}</span>}
                    </div>
                  </div>
                  <div className="pet-actions">
                    {!p.archived && (
                      <button type="button" className="pill-btn" onClick={(e) => { e.stopPropagation(); startEdit(p) }}>✏️</button>
                    )}
                    <button type="button" className="pill-btn" onClick={(e) => { e.stopPropagation(); toggleArchive(p) }}>
                      {p.archived ? 'Unarchive' : 'Archive'}
                    </button>
                    {p.archived && allowDelete && (
                      <button type="button" className="pill-btn danger" onClick={(e) => { e.stopPropagation(); deletePet(p) }}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          )}

          {showAdd ? (
            <div className="pet-edit-box">
              <div className="pet-edit-title">Add a pet</div>
              <PetForm
                values={addValues}
                onChange={setAddValues}
                onSubmit={saveNew}
                onCancel={() => { setShowAdd(false); setFormMsg('') }}
                submitLabel="Save Pet"
                message={formMsg}
                saving={saving}
              />
            </div>
          ) : (
            <button type="button" className="add-pet-btn" onClick={() => { setShowAdd(true); setFormMsg('') }}>
              + Add a pet
            </button>
          )}
        </div>
      </div>

      {selectedPet && !selectedPet.archived && (
        renderSelected ? renderSelected(selectedPet, load) : <VaccineHistory key={selectedPet.id} pet={selectedPet} />
      )}
    </>
  )
}