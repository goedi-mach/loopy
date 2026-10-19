import { useState } from 'react'
import { authHeaders } from './lib/api'
import { buildRabiesCert, certFilename, saveCertFile, toBase64 } from './lib/rabiesCert'
import type { Client, Pet, Vaccination } from './types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export default function CertActions({ record, pet, client }: { record: Vaccination; pet: Pet; client: Client }) {
  const [busy, setBusy] = useState<'' | 'download' | 'email'>('')
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  async function run(kind: 'download' | 'email') {
    setBusy(kind)
    setMsg(null)
    try {
      if (kind === 'email') {
        if (!client.email) throw new Error('No email address on file for this client.')
        if (!confirm(`Email ${pet.name}'s rabies certificate to ${client.email}?`)) return
      }
      const { bytes, problems } = await buildRabiesCert(record, pet, client)
      const filename = certFilename(pet, record)

      if (kind === 'download') {
        saveCertFile(bytes, filename)
        setMsg(
          problems.length
            ? { type: 'error', text: `Downloaded, but check the certificate: ${problems.join('; ')}` }
            : { type: 'success', text: 'Certificate downloaded.' }
        )
      } else {
        if (problems.length && !confirm(`Problems with this certificate:\n\n${problems.join('\n')}\n\nSend it anyway?`)) return
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-rabies-cert`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            to: client.email,
            petName: pet.name,
            pdfBase64: toBase64(bytes),
            filename,
          }),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Email failed')
        setMsg({ type: 'success', text: `Certificate emailed to ${client.email}` })
      }
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Something went wrong' })
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="cert-actions">
      <button type="button" className="btn-outline" disabled={!!busy} onClick={() => run('download')}>
        {busy === 'download' ? '⏳ Generating…' : '⬇ Download Rabies Certificate'}
      </button>
      <button type="button" className="btn-outline" disabled={!!busy || !client.email} onClick={() => run('email')}>
        {busy === 'email' ? '⏳ Sending…' : '✉ Email to Client'}
      </button>
      {msg && <div className={`msg ${msg.type}`} style={{ flexBasis: '100%' }}>{msg.text}</div>}
    </div>
  )
}