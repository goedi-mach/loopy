import { useState } from 'react'
import ClientDetail from './ClientDetail'
import ClientListCard from './components/ClientListCard'
import ClinicBanner from './components/ClinicBanner'
import ClinicNav from './components/ClinicNav'
import DischargePanel from './DischargePanel'
import { useClinicClients } from './hooks/useClinicClients'
import { sbPatch } from './lib/api'
import { getRole } from './lib/auth'
import type { Client } from './types'
import WalkIn from './WalkIn'
import './Intake.css'

export default function Clinic() {
  const list = useClinicClients()
  const [selected, setSelected] = useState<Client | null>(null)
  const [showWalkin, setShowWalkin] = useState(false)
  const [warning, setWarning] = useState('')
  const isAdmin = getRole() === 'admin'

  function handleUpdated(updated: Client) {
    setSelected(updated)
    list.updateClient(updated)
  }

  function handleDeleted() {
    setSelected(null)
    list.reload()
  }

  function handleWalkinSaved(client: Client) {
    setShowWalkin(false)
    setSelected(client)
    list.reload()
  }

  function handleUseExisting(client: Client) {
    setShowWalkin(false)
    setSelected(client)
  }

  // Logging a vaccine marks the client Discharged
  async function markDischarged() {
    if (!selected || selected.status === 'discharged') return
    try {
      const rows: Client[] = await sbPatch(`clients?id=eq.${selected.id}`, { status: 'discharged' })
      if (!rows.length) throw new Error('not allowed')
      handleUpdated({ ...selected, ...rows[0] })
      list.reload()
      setWarning('')
    } catch (err) {
      console.warn('Could not mark client discharged:', err)
      setWarning('The vaccine was saved, but the client could not be marked Discharged. Please tell an admin.')
    }
  }

  return (
    <div className="intake">
      <ClinicNav active="clinic" />
      <ClinicBanner event={list.todayEvent} />
      {warning && <div className="warning-bar">{warning}</div>}

      <div className="dash-body">
        <ClientListCard
          list={list}
          selectedId={selected?.id ?? null}
          onSelect={(c) => { setShowWalkin(false); setSelected(c) }}
          headerExtra={
            <button type="button" className="btn-primary btn-small" onClick={() => setShowWalkin(true)}>
              + Walk-in
            </button>
          }
        />

        <div>
          {showWalkin ? (
            <WalkIn
              onSaved={handleWalkinSaved}
              onUseExisting={handleUseExisting}
              onClose={() => setShowWalkin(false)}
            />
          ) : selected ? (
            <ClientDetail
              key={selected.id}
              client={selected}
              onUpdated={handleUpdated}
              allowDelete={isAdmin}
              showDocuments
              showAttendance
              onDeleted={handleDeleted}
              renderPet={(pet, reload) => (
                <>
                  <DischargePanel key={pet.id} pet={pet} client={selected} onLogged={markDischarged} onPetChanged={reload} />
                  <div className="print-links">
                    🖨 Print {pet.name}'s record:{' '}
                    <a href={`/client/${selected.id}/print/${pet.id}?lang=en`} target="_blank" rel="noreferrer">English</a>
                    {' · '}
                    <a href={`/client/${selected.id}/print/${pet.id}?lang=es`} target="_blank" rel="noreferrer">Español</a>
                  </div>
                </>
              )}
            />
          ) : (
            <div className="card">
              <div className="card-body">
                <div className="quick-ref">
                  <div className="quick-ref-title">👋 Quick Reference</div>
                  <div className="quick-ref-item"><span>🔍</span><div><strong>Find a client</strong> using the search bar, or tap <strong>+ Walk-in</strong> to register someone new.</div></div>
                  <div className="quick-ref-item"><span>✏️</span><div><strong>Fix any detail</strong> with the edit button on the client or on a pet.</div></div>
                  <div className="quick-ref-item"><span>🐾</span><div><strong>Select a pet</strong> to log vaccines or a microchip.</div></div>
                  <div className="quick-ref-item"><span>💉</span><div><strong>Log each vaccine</strong> with the lot number. A rabies cert will be generated.</div></div>
                  <div className="quick-ref-item"><span>✅</span><div><strong>Status updates automatically</strong> to Discharged when a vaccine is logged.</div></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}