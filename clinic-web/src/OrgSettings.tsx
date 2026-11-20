import { useState, type FormEvent } from 'react'
import ClinicNav from './components/ClinicNav'
import { request, sbPatch } from './lib/api'
import { DEFAULT_SETTINGS, logoSrc, useSettings, type OrgSettings } from './lib/settings'
import './Intake.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const HEX = /^#[0-9a-fA-F]{6}$/
const MAX_LOGO_BYTES = 1024 * 1024 // 1 MB

interface Msg {
  type: 'error' | 'success'
  text: string
}

const errText = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong')
const blankToNull = (v: string | null) => (v && v.trim() ? v.trim() : null)

function SettingsForm({ initial }: { initial: OrgSettings }) {
  const { reload } = useSettings()
  const [form, setForm] = useState<OrgSettings>(initial)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<Msg | null>(null)

  function set<K extends keyof OrgSettings>(key: K, value: OrgSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  // Each upload gets a new file name, so old links (emails already sent) keep working
  async function uploadLogo(file: File) {
    if (!file.type.startsWith('image/')) {
      setMsg({ type: 'error', text: 'The logo must be an image (PNG, JPG, SVG or WebP).' })
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setMsg({ type: 'error', text: 'The logo must be smaller than 1 MB.' })
      return
    }
    setUploading(true)
    setMsg(null)
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const name = `logo-${Date.now()}.${ext}`
      await request(`/storage/v1/object/branding/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      set('logo_url', `${SUPABASE_URL}/storage/v1/object/public/branding/${name}`)
      setMsg({ type: 'success', text: 'Logo uploaded. Click Save Settings to start using it.' })
    } catch (err) {
      setMsg({ type: 'error', text: 'Logo upload failed: ' + errText(err) })
    } finally {
      setUploading(false)
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!form.org_name.trim()) {
      setMsg({ type: 'error', text: 'Organization name is required.' })
      return
    }
    if (!HEX.test(form.primary_color) || !HEX.test(form.accent_color)) {
      setMsg({ type: 'error', text: 'Colors must look like #1a3a8f.' })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      const rows = await sbPatch('org_settings?id=eq.true', {
        org_name: form.org_name.trim(),
        city_region: blankToNull(form.city_region),
        website_url: blankToNull(form.website_url),
        contact_email: blankToNull(form.contact_email),
        logo_url: blankToNull(form.logo_url),
        primary_color: form.primary_color.toLowerCase(),
        accent_color: form.accent_color.toLowerCase(),
        default_language: form.default_language,
        updated_at: new Date().toISOString(),
      })
      // An empty answer means the database refused the change (not an admin)
      if (!rows.length) throw new Error('Nothing was saved. Only admins can change settings.')
      await reload()
      setMsg({ type: 'success', text: 'Settings saved.' })
    } catch (err) {
      setMsg({ type: 'error', text: errText(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save}>
      {msg && <div className={msg.type === 'error' ? 'warning-bar' : 'sh-success'}>{msg.text}</div>}

      <div className="sh-section">Organization</div>
      <div className="card">
        <div className="card-body">
          <div className="sh-row">
            <div className="sh-field">
              <label>Organization name *</label>
              <input value={form.org_name} onChange={(e) => set('org_name', e.target.value)} />
            </div>
            <div className="sh-field">
              <label>City / region</label>
              <input value={form.city_region || ''} placeholder="Chicago, IL" onChange={(e) => set('city_region', e.target.value)} />
            </div>
          </div>
          <div className="sh-row">
            <div className="sh-field">
              <label>Website</label>
              <input type="url" value={form.website_url || ''} placeholder="https://example.org" onChange={(e) => set('website_url', e.target.value)} />
            </div>
            <div className="sh-field">
              <label>Contact email</label>
              <input type="email" value={form.contact_email || ''} placeholder="info@example.org" onChange={(e) => set('contact_email', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="sh-section sh-section-gap">Branding</div>
      <div className="card">
        <div className="card-body">
          <div className="sh-row">
            <div className="sh-field">
              <label>Logo</label>
              <img src={logoSrc(form)} alt="Current logo" style={{ maxHeight: 80, maxWidth: 240, margin: '0.25rem 0 0.5rem' }} />
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
              />
              {form.logo_url && (
                <button type="button" className="btn-outline" style={{ marginTop: '0.5rem' }} onClick={() => set('logo_url', null)}>
                  Use the built-in logo
                </button>
              )}
            </div>
          </div>
          <div className="sh-row">
            <div className="sh-field">
              <label>Main color</label>
              <input type="color" value={form.primary_color} onChange={(e) => set('primary_color', e.target.value)} />
            </div>
            <div className="sh-field">
              <label>Accent color</label>
              <input type="color" value={form.accent_color} onChange={(e) => set('accent_color', e.target.value)} />
            </div>
          </div>
          <button
            type="button"
            className="btn-outline"
            onClick={() => setForm((f) => ({ ...f, primary_color: DEFAULT_SETTINGS.primary_color, accent_color: DEFAULT_SETTINGS.accent_color }))}
          >
            Reset to default colors
          </button>
        </div>
      </div>

      <div className="sh-section sh-section-gap">Language</div>
      <div className="card">
        <div className="card-body">
          <div className="sh-row">
            <div className="sh-field">
              <label>Default language for public pages</label>
              <select value={form.default_language} onChange={(e) => set('default_language', e.target.value as OrgSettings['default_language'])}>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }} disabled={saving || uploading}>
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </form>
  )
}

export default function OrgSettingsPage() {
  const { settings, loaded } = useSettings()
  return (
    <div className="intake">
      <ClinicNav active="settings" />
      <div className="records-main">
        <div className="page-title">⚙️ Settings</div>
        {loaded ? <SettingsForm initial={settings} /> : <div className="state-msg">Loading settings…</div>}
      </div>
    </div>
  )
}
