import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ClientDetail from './ClientDetail'
import ClinicNav from './components/ClinicNav'
import { sbGet } from './lib/api'
import { getRole } from './lib/auth'
import VaccineHistory from './VaccineHistory'
import Documents from './Documents'
import type { Client } from './types'
import './Intake.css'

// Everything except the (large) waiver signature image
const COLUMNS =
  'id,name,email,phone,address,created_at,status,archived,event_date,street,city,state,zip,notes,snip_interest,preferred_language'

export default function ClientProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [client, setClient] = useState<Client | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const isAdmin = getRole() === 'admin'

  useEffect(() => {
    setClient(null)
    setError('')
    sbGet<Client[]>(`clients?id=eq.${id}&select=${COLUMNS}`)
      .then((rows) => (rows.length ? setClient(rows[0]) : setError('Client not found')))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load client'))
  }, [id])

  async function copyId() {
    if (!client) return
    await navigator.clipboard.writeText(client.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="intake">
      <ClinicNav />
      <div className="profile-main">
        <Link className="back-link" to="/records">← Back to Records</Link>
        {error && <div className="card"><div className="card-body"><div className="empty-state error">{error}</div></div></div>}
        {!client && !error && <div className="card"><div className="card-body"><div className="empty-state">Loading…</div></div></div>}
        {client && (
          <ClientDetail
            key={client.id}
            client={client}
            onUpdated={setClient}
            allowDelete={isAdmin}
            onDeleted={() => navigate('/intake')}
            showDocuments
            hideProfile
            editEventDate
            showAttendance
            renderPet={(pet) => (
              <>
                <VaccineHistory key={pet.id} pet={pet} client={client} editable />
                <div className="print-links">
                  🖨 Print {pet.name}'s record:{' '}
                  <a href={`/client/${client.id}/print/${pet.id}?lang=en`} target="_blank" rel="noreferrer">English</a>
                  {' · '}
                  <a href={`/client/${client.id}/print/${pet.id}?lang=es`} target="_blank" rel="noreferrer">Español</a>
                </div>
                <Documents key={`docs-${pet.id}`} clientId={client.id} petId={pet.id} title={`${pet.name}'s Documents`} />
              </>
            )}
          />
        )}
      </div>
      {client && (
        <button type="button" className={copied ? 'copy-id copied' : 'copy-id'} onClick={copyId}>
          {copied ? '✓ Copied!' : '📋 Copy Client ID'}
        </button>
      )}
    </div>
  )
}