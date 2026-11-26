import { useCallback, useEffect, useState, type FormEvent } from 'react'
import ClinicNav from './components/ClinicNav'
import SignatureDialog from './components/SignatureDialog'
import VaccineTypesSettings from './VaccineTypesSettings'
import { request, sbPatch, sbPost } from './lib/api'
import { DEFAULT_SETTINGS, logoSrc, useSettings, type OrgSettings } from './lib/settings'
import { loadVets, signatureUrlPath, type Vet } from './lib/vets'
import { DEFAULT_WAIVER_EN, DEFAULT_WAIVER_ES } from './lib/waiver'
import './Intake.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const HEX = /^#[0-9a-fA-F]{6}$/
const MAX_LOGO_BYTES = 1024 * 1024 // 1 MB
const MAX_PDF_BYTES = 5 * 1024 * 1024 // 5 MB
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

interface Msg {
  type: 'error' | 'success'
  text: string
}

const errText = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong')
const blankToNull = (v: string | null) => (v && v.trim() ? v.trim() : null)

// Every time zone this browser knows, e.g. 'America/Chicago'
const TIME_ZONES = Intl.supportedValuesOf('timeZone')
const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

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

  // Take-home sheets are stored next to the logo, in the public branding bucket
  async function uploadPdf(field: 'take_home_en_url' | 'take_home_es_url', file: File) {
    if (file.type !== 'application/pdf') {
      setMsg({ type: 'error', text: 'The take-home sheet must be a PDF.' })
      return
    }
    if (file.size > MAX_PDF_BYTES) {
      setMsg({ type: 'error', text: 'The take-home sheet must be smaller than 5 MB.' })
      return
    }
    setUploading(true)
    setMsg(null)
    try {
      const name = `${field === 'take_home_en_url' ? 'take-home-en' : 'take-home-es'}-${Date.now()}.pdf`
      await request(`/storage/v1/object/branding/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      })
      set(field, `${SUPABASE_URL}/storage/v1/object/public/branding/${name}`)
      setMsg({ type: 'success', text: 'PDF uploaded. Click Save Settings to start using it.' })
    } catch (err) {
      setMsg({ type: 'error', text: 'PDF upload failed: ' + errText(err) })
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
    if (form.email_from?.trim() && !EMAIL_RE.test(form.email_from.trim())) {
      setMsg({ type: 'error', text: 'The "From" address doesn\'t look like an email address.' })
      return
    }
    if (form.microchip_register_url?.trim() && !form.microchip_register_url.includes('{chip}')) {
      setMsg({ type: 'error', text: 'The microchip registration link needs {chip} where the chip number goes.' })
      return
    }
    if (!form.waiver_en.trim() || !form.waiver_es.trim()) {
      setMsg({ type: 'error', text: 'The waiver needs wording in both English and Spanish (or restore the default).' })
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
        timezone: form.timezone,
        email_from: blankToNull(form.email_from),
        resources_url: blankToNull(form.resources_url),
        take_home_en_url: blankToNull(form.take_home_en_url),
        take_home_es_url: blankToNull(form.take_home_es_url),
        microchip_register_url: blankToNull(form.microchip_register_url),
        waiver_en: form.waiver_en.trim(),
        waiver_es: form.waiver_es.trim(),
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

      <div className="sh-section sh-section-gap">Language &amp; Time Zone</div>
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
            <div className="sh-field">
              <label>Time zone</label>
              <select value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
                {!TIME_ZONES.includes(form.timezone) && <option value={form.timezone}>{form.timezone}</option>}
                {TIME_ZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                ))}
              </select>
              {form.timezone !== deviceTimeZone() && (
                <button type="button" className="btn-link" style={{ marginTop: '0.35rem', textAlign: 'left' }} onClick={() => set('timezone', deviceTimeZone())}>
                  Use this device&apos;s time zone ({deviceTimeZone().replace(/_/g, ' ')})
                </button>
              )}
            </div>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            The time zone where your clinics happen. It decides the date recorded when someone registers and when reminder emails go out.
          </p>
        </div>
      </div>

      <div className="sh-section sh-section-gap">Waiver</div>
      <div className="card">
        <div className="card-body">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            The liability waiver people sign when they register. Leave a blank line between paragraphs.{' '}
            <code>{'{{org_name}}'}</code> is replaced with your organization&apos;s name. Changes apply to new signatures
            only: every signature keeps the exact wording it was signed under, and its waiver PDF prints that wording.
            Have your own legal advisor review the wording.
          </p>
          <div className="sh-row">
            {(
              [
                ['waiver_en', 'English', DEFAULT_WAIVER_EN],
                ['waiver_es', 'Español', DEFAULT_WAIVER_ES],
              ] as const
            ).map(([field, label, fallback]) => (
              <div className="sh-field" key={field}>
                <label>{label}</label>
                <textarea rows={14} value={form[field]} onChange={(e) => set(field, e.target.value)} />
                {form[field] !== fallback && (
                  <button
                    type="button"
                    className="btn-link"
                    style={{ marginTop: '0.35rem', textAlign: 'left' }}
                    onClick={() => confirm(`Replace the ${label} wording with the default?`) && set(field, fallback)}
                  >
                    Restore the default wording
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sh-section sh-section-gap">Emails</div>
      <div className="card">
        <div className="card-body">
          <div className="sh-row">
            <div className="sh-field">
              <label>“From” address</label>
              <input type="email" value={form.email_from || ''} placeholder="reminders@example.org" onChange={(e) => set('email_from', e.target.value)} />
            </div>
            <div className="sh-field">
              <label>Spay/neuter &amp; low-cost care resources (link)</label>
              <input type="url" value={form.resources_url || ''} placeholder="https://…" onChange={(e) => set('resources_url', e.target.value)} />
            </div>
          </div>
          <div className="sh-row">
            {(['take_home_en_url', 'take_home_es_url'] as const).map((field) => (
              <div className="sh-field" key={field}>
                <label>After-vaccine take-home sheet ({field === 'take_home_en_url' ? 'English' : 'Español'})</label>
                <input type="url" value={form[field] || ''} placeholder="https://… or upload a PDF" onChange={(e) => set(field, e.target.value)} />
                <input
                  type="file"
                  accept="application/pdf"
                  disabled={uploading}
                  style={{ marginTop: '0.35rem' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f) uploadPdf(field, f)
                  }}
                />
              </div>
            ))}
          </div>
          <div className="sh-row">
            <div className="sh-field">
              <label>Microchip registration link</label>
              <input value={form.microchip_register_url || ''} placeholder="https://registry.example.com/register?chip={chip}" onChange={(e) => set('microchip_register_url', e.target.value)} />
            </div>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            The “From” address&apos;s domain must be verified in your email service (Resend). Emails use the name, logo,
            website and main color above. In the microchip link, <code>{'{chip}'}</code> is replaced with each pet&apos;s chip
            number; leave it empty to list the chip numbers without a link. Email templates can also use{' '}
            <code>{'{{org_name}}'}</code>.
          </p>
        </div>
      </div>

      <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }} disabled={saving || uploading}>
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </form>
  )
}

// ── Veterinarians ──────────────────────────────────────────────

const muted = { color: 'var(--text-muted)' }

function VetRow({ vet, onChanged, setMsg }: { vet: Vet; onChanged: () => Promise<void>; setMsg: (m: Msg | null) => void }) {
  const [name, setName] = useState(vet.name)
  const [license, setLicense] = useState(vet.license_number || '')
  const [busy, setBusy] = useState(false)
  const [sigUrl, setSigUrl] = useState<string | null>(null)
  const [drawing, setDrawing] = useState(false)
  const dirty = name.trim() !== vet.name || license.trim() !== (vet.license_number || '')

  // The signature is in a private bucket, so load it with the admin's token to show a preview
  useEffect(() => {
    if (!vet.signature_path) return
    let url = ''
    let cancelled = false
    request(signatureUrlPath(vet.signature_path))
      .then((r) => r.blob())
      .then((b) => {
        if (cancelled) return
        url = URL.createObjectURL(b)
        setSigUrl(url)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [vet.signature_path])

  // Do one change, reload the list, and report the result
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    setMsg(null)
    try {
      await action()
      await onChanged()
      setMsg({ type: 'success', text: success })
    } catch (err) {
      setMsg({ type: 'error', text: errText(err) })
    } finally {
      setBusy(false)
    }
  }

  async function patch(data: Partial<Vet>) {
    const rows = await sbPatch(`vets?id=eq.${vet.id}`, data)
    if (!rows.length) throw new Error('Nothing was saved. Only admins can change vets.')
  }

  const save = () =>
    run(() => patch({ name: name.trim(), license_number: license.trim() || null }), `Saved ${name.trim()}.`)

  // Only one primary vet is allowed, so clear the current one first
  const makePrimary = () =>
    run(async () => {
      await sbPatch('vets?is_primary=eq.true', { is_primary: false })
      await patch({ is_primary: true, active: true })
    }, `${vet.name} now signs rabies certificates.`)

  const toggleActive = () =>
    run(() => patch({ active: !vet.active }), vet.active ? `${vet.name} is no longer listed.` : `${vet.name} is listed again.`)

  // Each upload gets a new file name; the certificate code only reads PNG or JPG
  const uploadSignature = (file: File) =>
    run(async () => {
      if (!['image/png', 'image/jpeg'].includes(file.type)) throw new Error('The signature must be a PNG or JPG image.')
      if (file.size > MAX_LOGO_BYTES) throw new Error('The signature image must be smaller than 1 MB.')
      const fileName = `sig-${vet.id}-${Date.now()}.${file.type === 'image/png' ? 'png' : 'jpg'}`
      await request(`/storage/v1/object/signatures/${fileName}`, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      await patch({ signature_path: fileName })
    }, `Signature saved for ${vet.name}.`)

  return (
    <tr>
      <td><input value={name} onChange={(e) => setName(e.target.value)} /></td>
      <td><input value={license} placeholder="License #" onChange={(e) => setLicense(e.target.value)} /></td>
      <td>
        {sigUrl ? (
          <img src={sigUrl} alt={`${vet.name} signature`} style={{ maxHeight: 32, maxWidth: 140, display: 'block', marginBottom: 4 }} />
        ) : (
          <div style={muted}>{vet.signature_path ? 'Uploaded' : 'None'}</div>
        )}
        <button type="button" className="btn-outline" disabled={busy} onClick={() => setDrawing(true)}>
          ✍️ {vet.signature_path ? 'Redraw' : 'Draw signature'}
        </button>
        <label style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.8rem', ...muted }}>
          or upload an image:
          <input
            type="file"
            accept="image/png,image/jpeg"
            disabled={busy}
            style={{ display: 'block', marginTop: '0.2rem' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) uploadSignature(f)
            }}
          />
        </label>
        {drawing && (
          <SignatureDialog
            title={`Signature for ${vet.name}`}
            onCancel={() => setDrawing(false)}
            onSave={(png) => {
              setDrawing(false)
              // Saved the same way as an uploaded image
              uploadSignature(new File([png], 'signature.png', { type: 'image/png' }))
            }}
          />
        )}
      </td>
      <td>{vet.is_primary ? <strong>Primary</strong> : vet.active ? 'Active' : <span style={muted}>Inactive</span>}</td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {dirty && (
          <button type="button" className="btn-outline" disabled={busy || !name.trim()} onClick={save}>Save</button>
        )}{' '}
        {!vet.is_primary && vet.active && (
          <button type="button" className="btn-outline" disabled={busy} onClick={makePrimary}>Make primary</button>
        )}{' '}
        {!vet.is_primary && (
          <button type="button" className="btn-outline" disabled={busy} onClick={toggleActive}>
            {vet.active ? 'Deactivate' : 'Reactivate'}
          </button>
        )}
      </td>
    </tr>
  )
}

function VetsSection() {
  const [vets, setVets] = useState<Vet[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [msg, setMsg] = useState<Msg | null>(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLicense, setNewLicense] = useState('')

  const refresh = useCallback(async () => {
    try {
      setVets(await loadVets(true))
      setLoadError('')
    } catch (err) {
      setLoadError(errText(err))
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function addVet(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim()) {
      setMsg({ type: 'error', text: "Enter the vet's name." })
      return
    }
    setAdding(true)
    setMsg(null)
    try {
      // The first vet added becomes the primary vet
      await sbPost('vets', {
        name: newName.trim(),
        license_number: newLicense.trim() || null,
        is_primary: !vets?.some((v) => v.is_primary),
      })
      setMsg({ type: 'success', text: `Added ${newName.trim()}.` })
      setNewName('')
      setNewLicense('')
      await refresh()
    } catch (err) {
      setMsg({ type: 'error', text: errText(err) })
    } finally {
      setAdding(false)
    }
  }

  return (
    <>
      <div className="sh-section sh-section-gap">Veterinarians</div>
      {msg && <div className={msg.type === 'error' ? 'warning-bar' : 'sh-success'}>{msg.text}</div>}
      <div className="card">
        <div className="card-body">
          <p style={{ ...muted, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            Active vets appear under “Administered By” when logging vaccines. The primary vet&apos;s name, license number
            and signature go on every rabies certificate. Renaming a vet doesn&apos;t change vaccinations already logged.
          </p>
          {loadError && <div className="warning-bar">Error: {loadError}</div>}
          {!vets && !loadError && <div className="state-msg">Loading vets…</div>}
          {vets && vets.length > 0 && (
            <div className="table-wrap">
              <table className="rec-table">
                <thead>
                  <tr><th>Name</th><th>License #</th><th>Signature</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {vets.map((v) => (
                    // The key changes after a save, so the row's inputs start from the saved values
                    <VetRow key={`${v.id}|${v.name}|${v.license_number}`} vet={v} onChanged={refresh} setMsg={setMsg} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <form onSubmit={addVet} style={{ marginTop: '1rem' }}>
            <div className="sh-row">
              <div className="sh-field">
                <label>New vet&apos;s name</label>
                <input value={newName} placeholder="Dr. Jane Doe" onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="sh-field">
                <label>License #</label>
                <input value={newLicense} onChange={(e) => setNewLicense(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={adding}>{adding ? 'Adding…' : 'Add Vet'}</button>
          </form>
        </div>
      </div>
    </>
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
        <VetsSection />
        <VaccineTypesSettings />
      </div>
    </div>
  )
}
