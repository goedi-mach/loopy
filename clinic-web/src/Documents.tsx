import { useEffect, useState } from 'react'
import { request, sbDelete, sbGet, sbPost } from './lib/api'
import { getUserId } from './lib/auth'
import type { Attachment } from './types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const MAX_MB = 10

interface Props {
  clientId: string
  petId?: string
  title?: string
}

export default function Documents({ clientId, petId, title }: Props) {
  const [docs, setDocs] = useState<Attachment[] | null>(null)
  const [open, setOpen] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  useEffect(() => {
    const filter = petId ? `pet_id=eq.${petId}` : `client_id=eq.${clientId}&pet_id=is.null`
    sbGet<Attachment[]>(`attachments?${filter}&order=uploaded_at.desc`)
      .then(setDocs)
      .catch((err) => {
        setDocs([])
        setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Could not load documents' })
      })
  }, [clientId, petId])

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const file = input.files?.[0]
    if (!file) return
    if (file.size > MAX_MB * 1024 * 1024) {
      setMsg({ type: 'error', text: `That file is over ${MAX_MB} MB.` })
      input.value = ''
      return
    }
    setUploading(true)
    setMsg(null)
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const folder = petId ? `pets/${petId}` : `clients/${clientId}`
    const path = `${folder}/${Date.now()}_${safeName}`
    try {
      await request(`/storage/v1/object/attachments/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })
      try {
        const rows = await sbPost<Attachment>('attachments', {
          client_id: clientId,
          pet_id: petId ?? null,
          storage_path: `attachments/${path}`,
          display_name: file.name,
          uploaded_by: getUserId(),
        })
        if (!rows.length) throw new Error('The document record was not saved')
        setDocs((prev) => [rows[0], ...(prev || [])])
      } catch (err) {
        // Don't leave an orphaned file behind
        await request(`/storage/v1/object/attachments/${path}`, { method: 'DELETE' }).catch(() => {})
        throw err
      }
      setMsg({ type: 'success', text: 'Uploaded.' })
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Upload failed' })
    } finally {
      setUploading(false)
      input.value = ''
    }
  }

  async function openDoc(d: Attachment) {
    const win = window.open('', '_blank') // open now so pop-up blockers allow it
    try {
      const res = await request(`/storage/v1/object/sign/${d.storage_path}`, {
        method: 'POST',
        body: JSON.stringify({ expiresIn: 300 }),
      })
      const { signedURL } = await res.json()
      if (!win) throw new Error('Your browser blocked the new tab. Allow pop-ups and try again.')
      win.location.href = `${SUPABASE_URL}/storage/v1${signedURL}`
    } catch (err) {
      win?.close()
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Could not open the file' })
    }
  }

  async function remove(d: Attachment) {
    if (!confirm(`Delete "${d.display_name}"? This cannot be undone.`)) return
    try {
      const rows = await sbDelete(`attachments?id=eq.${d.id}`)
      if (!rows.length) throw new Error('Delete was not allowed for your account')
      // Record is gone; now remove the file (best effort)
      await request(`/storage/v1/object/${d.storage_path}`, { method: 'DELETE' }).catch(() => {})
      setDocs((prev) => (prev || []).filter((x) => x.id !== d.id))
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Delete failed' })
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <button type="button" className="section-toggle" onClick={() => setOpen(!open)}>
          <span>📎 {title || 'Documents'}</span>
          <span className={open ? 'toggle-icon open' : 'toggle-icon'}>▼</span>
        </button>
      </div>
      {open && (
        <div className="card-body">
          {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
          {!docs && <div className="empty-state">Loading…</div>}
          {docs && docs.length === 0 && <div className="empty-state">No documents</div>}
          {docs?.map((d) => (
            <div key={d.id} className="doc-item">
              <button type="button" className="doc-link" onClick={() => openDoc(d)}>📄 {d.display_name}</button>
              <button type="button" className="doc-delete" title="Delete" onClick={() => remove(d)}>✕</button>
            </div>
          ))}
          <div style={{ marginTop: '0.75rem' }}>
            <label className="btn-outline upload-label">
              {uploading ? 'Uploading…' : '+ Upload'}
              <input type="file" hidden disabled={uploading} onChange={upload} />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}