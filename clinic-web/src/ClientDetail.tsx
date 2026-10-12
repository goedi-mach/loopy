import { useEffect, useRef, useState } from 'react'
import { sbPatch } from './lib/api'
import PetList from './PetList'
import type { Client } from './types'

const STATUS_LABEL: Record<string, string> = { registered: 'Registered', discharged: 'Discharged' }

// Build the address from the split fields; fall back to the old single "address" column
function formatAddress(c: Client) {
  const cityLine = [c.city, [c.state, c.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const split = [c.street, cityLine].filter(Boolean).join(', ')
  return split || c.address || ''
}

interface Props {
  client: Client
  onUpdated: (c: Client) => void
}

export default function ClientDetail({ client, onUpdated }: Props) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', street: '', city: '', state: '', zip: '' })
  const [editMsg, setEditMsg] = useState('')
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState(client.notes || '')
  const [notesMsg, setNotesMsg] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the ⋯ menu when clicking elsewhere
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  // Update the client on the server, then tell the parent so the list stays in sync
  async function patchClient(changes: Partial<Client>) {
    const rows: Client[] = await sbPatch(`clients?id=eq.${client.id}`, changes)
    if (!rows.length) throw new Error('Save was not allowed')
    const updated = { ...client, ...rows[0] }
    onUpdated(updated)
    return updated
  }

  function openEdit() {
    setForm({
      name: client.name || '',
      phone: client.phone || '',
      email: client.email || '',
      street: client.street ?? client.address ?? '',
      city: client.city || '',
      state: client.state || '',
      zip: client.zip || '',
    })
    setEditMsg('')
    setEditing(true)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setEditMsg('Name is required.')
    try {
      await patchClient({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        street: form.street.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim().toUpperCase() || null,
        zip: form.zip.trim() || null,
      })
      setEditing(false)
    } catch (err) {
      setEditMsg(err instanceof Error ? err.message : 'Save failed')
    }
  }

  async function toggleArchive() {
    setMenuOpen(false)
    try {
      await patchClient({ archived: !client.archived })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not update client')
    }
  }

  async function saveSnip(checked: boolean) {
    try {
      await patchClient({ snip_interest: checked })
    } catch (err) {
      console.error('Could not save spay/neuter interest:', err)
    }
  }

  async function saveNotes() {
    try {
      await patchClient({ notes: notes.trim() || null })
      setNotesMsg('Saved.')
    } catch (err) {
      setNotesMsg(err instanceof Error ? err.message : 'Save failed')
    }
    setTimeout(() => setNotesMsg(''), 3000)
  }

  const set = (field: keyof typeof form, value: string) => setForm({ ...form, [field]: value })
  const contact = [client.phone, client.email, formatAddress(client)].filter(Boolean).join(' · ')

  return (
    <>
      <div className="card">
        <div className="card-body">
          {editing ? (
            <form onSubmit={saveEdit}>
              {editMsg && <div className="msg error">{editMsg}</div>}
              <div className="form-row">
                <div className="form-field">
                  <label>Name *</label>
                  <input value={form.name} onChange={(e) => set('name', e.target.value)} />
                </div>
                <div className="form-field">
                  <label>Phone</label>
                  <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
                </div>
              </div>
              <div className="form-field">
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Street</label>
                <input value={form.street} onChange={(e) => set('street', e.target.value)} />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>City</label>
                  <input value={form.city} onChange={(e) => set('city', e.target.value)} />
                </div>
                <div className="form-field">
                  <label>State</label>
                  <input maxLength={2} value={form.state} onChange={(e) => set('state', e.target.value)} />
                </div>
              </div>
              <div className="form-field">
                <label>ZIP</label>
                <input maxLength={10} value={form.zip} onChange={(e) => set('zip', e.target.value)} />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary">Save</button>
                <button type="button" className="btn-link" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <>
              <div className="client-head">
                <div>
                  <div className="client-title">
                    <span className="client-big-name">{client.name}</span>
                    {client.preferred_language && (
                      <span className={client.preferred_language === 'es' ? 'lang-badge lang-es' : 'lang-badge lang-en'}>
                        {client.preferred_language === 'es' ? 'ES' : 'EN'}
                      </span>
                    )}
                    {client.status && STATUS_LABEL[client.status] && (
                      <span className={`badge badge-${client.status}`}>{STATUS_LABEL[client.status]}</span>
                    )}
                    {client.archived && <span className="badge badge-archived">Archived</span>}
                  </div>
                  <div className="client-contact">{contact || 'No contact info'}</div>
                  <div className="client-since">
                    Client since {new Date(client.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div className="client-buttons">
                  {!client.archived && (
                    <button type="button" className="btn-primary btn-small" onClick={openEdit}>✏️ Edit</button>
                  )}
                  <a className="profile-link" href={`/client.html?id=${client.id}`}>👤 Profile</a>
                  <button type="button" className="notes-btn" title="Notes & flags" onClick={() => setNotesOpen(!notesOpen)}>📝</button>
                  <div className="menu-wrap" ref={menuRef}>
                    <button type="button" className="overflow-btn" onClick={() => setMenuOpen(!menuOpen)}>⋯</button>
                    {menuOpen && (
                      <div className="overflow-menu">
                        <button type="button" onClick={toggleArchive}>{client.archived ? 'Unarchive' : 'Archive'}</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {notesOpen && (
                <div className="notes-tray">
                  <label className="snip-label">
                    <input
                      type="checkbox"
                      checked={!!client.snip_interest}
                      onChange={(e) => saveSnip(e.target.checked)}
                    />
                    Interested in spay/neuter resources
                  </label>
                  <textarea
                    value={notes}
                    placeholder="Permanent notes about this client…"
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <div className="notes-footer">
                    <span className="notes-msg">{notesMsg}</span>
                    <button type="button" className="save-notes-btn" onClick={saveNotes}>Save notes</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <PetList clientId={client.id} />
    </>
  )
}